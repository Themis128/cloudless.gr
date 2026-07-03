/*
 * homelab_alert_led — Display ESP32 firmware v1.0
 * Board  : ESP32 Dev Module (4 MB flash, default partition)
 * LED    : WS2812B strip, 8 LEDs, GPIO 4
 * MQTT   : subscribes homelab/alerts/status (retained, QoS 1)
 *          broker: 192.168.1.128:31883 (Mosquitto K3s NodePort)
 * LWT    : publishes "offline" to homelab/esp32/lwt on ungraceful disconnect
 *
 * Payload schema (homelab/alerts/status):
 *   {"severity":"ok|info|warning|error|high|critical","count":N,"timestamp":T}
 *
 * LED PATTERNS
 * ────────────────────────────────────────────────────────────────────────────
 * severity    color   pattern
 * ok          Green   Solid                       ← "all OK" — no active alerts
 * debug       Blue    Solid                       (mapped to info)
 * info        Blue    Solid
 * low         Blue    Solid                       (mapped to info)
 * warning     Amber   Slow sine pulse (2 s period)
 * medium      Amber   Slow sine pulse (2 s period) (mapped to warning)
 * error       Orange  Blink 500 ms on / 500 ms off
 * high        Red     Fast blink 200 ms on / 200 ms off
 * critical    Red     Strobe 80 ms on / 80 ms off
 * disconnected White  Slow sine pulse (3 s period)
 * muted        Blue   Rare blink every 5 s (dim)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Severity source: pi-alert-api mqtt_publish.py publishes the worst active
 * alert severity to homelab/alerts/status (retained). The AlertIn model
 * allows critical|high|medium|low|info, so ALL of those must map to a
 * non-green LED state — otherwise a medium/low alert would incorrectly read
 * as "all OK" (green). medium→warning(amber), low/debug→info(blue).
 *
 * IMPORTANT — Core 1 pinning:
 *   FastLED uses the ESP32 RMT peripheral which shares interrupt priority with
 *   WiFi DMA on Core 0. The LED task is pinned to Core 1 via
 *   xTaskCreatePinnedToCore to prevent corrupted pixels under WiFi load.
 *
 * Dependencies (Arduino Library Manager):
 *   AsyncMqttClient  — marvinroger/async-mqtt-client  (≥0.9)
 *   AsyncTCP         — me-no-dev/AsyncTCP              (≥1.1)
 *   FastLED          — FastLED/FastLED                 (≥3.6)
 *   ArduinoJson      — bblanchon/ArduinoJson           (≥7.0)
 */

#include <WiFi.h>
#include <AsyncMqttClient.h>
#include <FastLED.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ── User configuration ────────────────────────────────────────────────────────
// Secrets (wifi password, MQTT password) live in a sibling secrets.h file
// that is .gitignored. Copy secrets.h.template → secrets.h, fill in, then
// build. The header is required — `#include "secrets.h"` is mandatory.
#include "secrets.h"

#define WIFI_SSID           "COSMOTE1"
// WIFI_PASS comes from secrets.h

#define MQTT_HOST           "192.168.1.128"
#define MQTT_PORT           31883
// Mosquitto broker is auth-only since 2026-06-21 (Phase 3 cutover).
// MQTT_USERNAME / MQTT_PASSWORD live in secrets.h.
// To match the cluster: tbaltzakis / <unified admin password>.
#define ALERT_API_HOST      "192.168.1.128"
#define ALERT_API_PORT      30800

#define LED_PIN             4
#define NUM_LEDS            8
#define LED_TYPE            WS2812B
#define COLOR_ORDER         GRB
#define MUTE_BUTTON_PIN     0    // boot button doubles as mute toggle

#define HEARTBEAT_INTERVAL_MS  60000UL   // POST /api/esp32/heartbeat every 60 s
#define STALE_THRESHOLD_MS     90000UL   // no MQTT message in 90 s → disconnected state

// ── Globals ───────────────────────────────────────────────────────────────────
CRGB leds[NUM_LEDS];
AsyncMqttClient mqttClient;
TimerHandle_t   wifiReconnectTimer;
TimerHandle_t   mqttReconnectTimer;

enum Severity { SEV_OK, SEV_INFO, SEV_WARNING, SEV_ERROR, SEV_HIGH, SEV_CRITICAL };

volatile Severity  gSeverity       = SEV_OK;
volatile bool      gMuted          = false;
volatile bool      gMqttConnected  = false;
volatile unsigned long gLastMsgMs  = 0;
volatile unsigned long gLastHeartbeatMs = 0;

// ISR-safe mute toggle — debounced in the LED task
volatile bool gMuteTogglePending = false;
unsigned long gLastButtonMs = 0;

static TaskHandle_t ledTaskHandle = nullptr;
static bool         ledTaskStarted = false;

// ── Severity helpers ──────────────────────────────────────────────────────────
static Severity parseSeverity(const char* s) {
  if (!s) return SEV_OK;
  if (strcmp(s, "critical") == 0) return SEV_CRITICAL;
  if (strcmp(s, "high")     == 0) return SEV_HIGH;
  if (strcmp(s, "error")    == 0) return SEV_ERROR;
  if (strcmp(s, "warning")  == 0) return SEV_WARNING;
  if (strcmp(s, "medium")   == 0) return SEV_WARNING;  // medium → amber pulse
  if (strcmp(s, "info")     == 0) return SEV_INFO;
  if (strcmp(s, "low")      == 0) return SEV_INFO;     // low → blue solid
  if (strcmp(s, "debug")    == 0) return SEV_INFO;     // debug → blue solid
  return SEV_OK;
}

// ── LED helpers ───────────────────────────────────────────────────────────────
static void fillAll(CRGB color) {
  fill_solid(leds, NUM_LEDS, color);
  FastLED.show();
}

// Sine pulse: fade between minBright and 255 over periodMs.
// Returns after one full cycle. Checks for severity change mid-cycle.
static void sinePulse(CRGB baseColor, uint32_t periodMs,
                      Severity expectedSev, bool expectedMute) {
  const uint32_t step = 10;
  uint32_t elapsed = 0;
  while (elapsed < periodMs) {
    if (gSeverity != expectedSev || gMuted != expectedMute) return;
    float angle = (float)elapsed / periodMs * 2.0f * PI;
    uint8_t bright = (uint8_t)(128 + 127 * sinf(angle));
    CRGB c = baseColor;
    c.nscale8(bright);
    fillAll(c);
    vTaskDelay(pdMS_TO_TICKS(step));
    elapsed += step;
  }
}

// ── LED task (pinned to Core 1) ───────────────────────────────────────────────
static void ledTask(void* /*param*/) {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(80);
  fillAll(CRGB::Black);

  for (;;) {
    // Debounce mute toggle
    if (gMuteTogglePending) {
      unsigned long now = millis();
      if (now - gLastButtonMs > 300) {
        gMuted = !gMuted;
        gLastButtonMs = now;
      }
      gMuteTogglePending = false;
    }

    bool muted       = gMuted;
    bool connected   = gMqttConnected;
    unsigned long ms = millis();
    bool stale       = connected && (ms - gLastMsgMs) > STALE_THRESHOLD_MS;
    bool disconnected = !connected || stale;
    Severity sev     = gSeverity;

    if (muted) {
      // Dim blue, rare blink every 5 s
      fillAll(CRGB(0, 0, 20));
      vTaskDelay(pdMS_TO_TICKS(4800));
      fillAll(CRGB::Black);
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    if (disconnected) {
      sinePulse(CRGB::White, 3000, sev, muted);
      continue;
    }

    switch (sev) {
      case SEV_OK:
        fillAll(CRGB(0, 200, 0));
        vTaskDelay(pdMS_TO_TICKS(100));
        break;

      case SEV_INFO:
        fillAll(CRGB(0, 0, 200));
        vTaskDelay(pdMS_TO_TICKS(100));
        break;

      case SEV_WARNING:
        sinePulse(CRGB(255, 160, 0), 2000, sev, muted);
        break;

      case SEV_ERROR:
        fillAll(CRGB(255, 80, 0));
        vTaskDelay(pdMS_TO_TICKS(500));
        fillAll(CRGB::Black);
        vTaskDelay(pdMS_TO_TICKS(500));
        break;

      case SEV_HIGH:
        fillAll(CRGB(255, 0, 0));
        vTaskDelay(pdMS_TO_TICKS(200));
        fillAll(CRGB::Black);
        vTaskDelay(pdMS_TO_TICKS(200));
        break;

      case SEV_CRITICAL:
        fillAll(CRGB(255, 0, 0));
        vTaskDelay(pdMS_TO_TICKS(80));
        fillAll(CRGB::Black);
        vTaskDelay(pdMS_TO_TICKS(80));
        break;
    }
  }
}

// ── Mute button ISR ───────────────────────────────────────────────────────────
void IRAM_ATTR onMuteButton() {
  gMuteTogglePending = true;
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
static void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  char url[64];
  snprintf(url, sizeof(url), "http://%s:%d/api/esp32/heartbeat",
           ALERT_API_HOST, ALERT_API_PORT);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  char body[256];
  snprintf(body, sizeof(body),
    "{\"device_id\":\"homelab-alert-led\","
    "\"ip\":\"%s\","
    "\"rssi\":%d,"
    "\"uptime_s\":%lu,"
    "\"free_ram_bytes\":%lu,"
    "\"firmware_ver\":\"1.0.0\"}",
    WiFi.localIP().toString().c_str(),
    WiFi.RSSI(),
    (unsigned long)(millis() / 1000),
    (unsigned long)ESP.getFreeHeap());

  http.POST(body);
  http.end();
}

// ── WiFi + MQTT reconnect timers ──────────────────────────────────────────────
static void connectToWifi() {
  Serial.println("[WiFi] Connecting...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

static void connectToMqtt() {
  Serial.println("[MQTT] Connecting...");
  mqttClient.connect();
}

static void onWifiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.printf("[WiFi] Connected, IP: %s\n",
                    WiFi.localIP().toString().c_str());
      connectToMqtt();
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("[WiFi] Disconnected");
      gMqttConnected = false;
      xTimerStop(mqttReconnectTimer, 0);
      xTimerStart(wifiReconnectTimer, 0);
      break;
    default:
      break;
  }
}

// ── MQTT callbacks ────────────────────────────────────────────────────────────
static void onMqttConnect(bool sessionPresent) {
  Serial.println("[MQTT] Connected");
  gMqttConnected = true;
  gLastMsgMs = millis();
  mqttClient.subscribe("homelab/alerts/status", 1);
}

static void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  Serial.printf("[MQTT] Disconnected, reason=%d\n", (int)reason);
  gMqttConnected = false;
  if (WiFi.isConnected()) {
    xTimerStart(mqttReconnectTimer, 0);
  }
}

static void onMqttMessage(char* topic, char* payload,
                           AsyncMqttClientMessageProperties /*props*/,
                           size_t len, size_t /*index*/, size_t /*total*/) {
  gLastMsgMs = millis();

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) return;

  const char* sev = doc["severity"] | "ok";
  gSeverity = parseSeverity(sev);

  Serial.printf("[MQTT] status: severity=%s count=%d\n",
                sev, (int)doc["count"]);
}

// ── Arduino entry points ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(MUTE_BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(MUTE_BUTTON_PIN), onMuteButton, FALLING);

  // Reconnect timers (2 s WiFi, 5 s MQTT)
  wifiReconnectTimer = xTimerCreate("wifiReconnect", pdMS_TO_TICKS(2000),
                                    pdFALSE, nullptr,
                                    [](TimerHandle_t) { connectToWifi(); });
  mqttReconnectTimer = xTimerCreate("mqttReconnect", pdMS_TO_TICKS(5000),
                                    pdFALSE, nullptr,
                                    [](TimerHandle_t) { connectToMqtt(); });

  // MQTT config
  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  mqttClient.onMessage(onMqttMessage);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  // Mosquitto is auth-only since the Phase 3 cutover on 2026-06-21 —
  // setCredentials() must be called or the broker returns CONNACK 5.
  // Per docs/2.-API-reference.md in marvinroger/async-mqtt-client, this
  // sets the username/password used during MQTT CONNECT. Default = none.
  mqttClient.setCredentials(MQTT_USERNAME, MQTT_PASSWORD);
  mqttClient.setClientId("homelab-alert-led");
  // LWT: broker publishes "offline" to homelab/esp32/lwt on ungraceful disconnect
  mqttClient.setWill("homelab/esp32/lwt", 1, true, "offline");

  // WiFi
  WiFi.onEvent(onWifiEvent);
  connectToWifi();

  // LED task pinned to Core 1 (avoids RMT/WiFi DMA conflict on Core 0)
  xTaskCreatePinnedToCore(
    ledTask, "led", 4096, nullptr, 1, &ledTaskHandle, /*core=*/1);
}

void loop() {
  // Heartbeat from Core 0 (safe — HTTPClient not used in LED task)
  if (millis() - gLastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    gLastHeartbeatMs = millis();
    sendHeartbeat();
  }
  delay(1000);
}
