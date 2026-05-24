/*
 * homelab_alert_led — Display ESP32 firmware
 * Board  : ESP32 (any variant)
 * LED    : WS2812B strip, 8 LEDs, GPIO 4
 * MQTT   : subscribes to homelab/alerts/status (retained, QoS 1)
 *          broker: 192.168.1.128:31883 (Mosquitto K3s NodePort)
 *
 * Payload: {"severity":"info|warning|critical","count":N,"timestamp":T}
 *
 * LED STATE MATRIX
 * ─────────────────────────────────────────────────────────────────────────
 * severity │ count │ Effect
 * ─────────┼───────┼──────────────────────────────────────────────────────
 * (none)   │  0    │ Solid green (all healthy)
 * info     │  ≥1   │ Slow cyan pulse
 * warning  │  ≥1   │ Slow orange blink
 * critical │  ≥1   │ Fast red blink
 * (stale)  │  —    │ Dim blue breathing (broker unreachable > 60 s)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Dependencies (install via Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary  (≥2.8)
 *   - FastLED by Daniel Garcia      (≥3.6)
 *   - ArduinoJson by Benoit Blanchon (≥7.0)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <FastLED.h>
#include <ArduinoJson.h>

// ── Configuration ────────────────────────────────────────────────────────────
#define WIFI_SSID       "COSMOTE1"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"   // replace before flash

#define MQTT_HOST       "192.168.1.128"
#define MQTT_PORT       31883
#define MQTT_CLIENT_ID  "homelab-alert-led"
#define MQTT_TOPIC      "homelab/alerts/status"

#define LED_PIN         4
#define NUM_LEDS        8
#define LED_TYPE        WS2812B
#define COLOR_ORDER     GRB
#define LED_BRIGHTNESS  80   // 0-255 global brightness

// Stale threshold: if no MQTT message received in this many ms, go "stale" mode
#define STALE_MS        60000UL

// ── Globals ───────────────────────────────────────────────────────────────────
CRGB leds[NUM_LEDS];
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

enum AlertSeverity { SEV_NONE, SEV_INFO, SEV_WARNING, SEV_CRITICAL, SEV_STALE };
volatile AlertSeverity currentSeverity = SEV_NONE;
volatile int           alertCount      = 0;
volatile unsigned long lastMsgMs       = 0;

// ── MQTT callback ─────────────────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  lastMsgMs = millis();

  // Parse JSON payload
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) return;

  const char* sev = doc["severity"] | "";
  int count = doc["count"] | 0;

  alertCount = count;
  if (count == 0) {
    currentSeverity = SEV_NONE;
  } else if (strcmp(sev, "critical") == 0) {
    currentSeverity = SEV_CRITICAL;
  } else if (strcmp(sev, "warning") == 0) {
    currentSeverity = SEV_WARNING;
  } else {
    currentSeverity = SEV_INFO;
  }
}

// ── LED effects ───────────────────────────────────────────────────────────────
static void fillAll(CRGB color) {
  fill_solid(leds, NUM_LEDS, color);
  FastLED.show();
}

// Blink: on_ms on, off_ms off
static void blinkEffect(CRGB color, uint16_t on_ms, uint16_t off_ms) {
  fillAll(color);
  delay(on_ms);
  fillAll(CRGB::Black);
  delay(off_ms);
}

// Breathing: fade in/out over period_ms
static void breatheEffect(CRGB baseColor, uint16_t period_ms) {
  uint16_t half = period_ms / 2;
  unsigned long start = millis();
  unsigned long elapsed = millis() - start;
  while (elapsed < (unsigned long)period_ms) {
    elapsed = millis() - start;
    uint8_t phase = (elapsed < half)
      ? map(elapsed, 0, half, 0, 255)
      : map(elapsed - half, 0, half, 255, 0);
    CRGB c = baseColor;
    c.nscale8(phase);
    fillAll(c);
    delay(10);
  }
}

// ── WiFi + MQTT setup ─────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  // Show yellow during connection
  fillAll(CRGB(255, 180, 0));
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectMQTT() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  while (!mqttClient.connected()) {
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      mqttClient.subscribe(MQTT_TOPIC, 1);
    } else {
      delay(2000);
    }
  }
  // Show brief white flash on connect
  fillAll(CRGB::White);
  delay(200);
}

// ── Arduino entry points ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(LED_BRIGHTNESS);
  fillAll(CRGB::Black);

  connectWiFi();
  connectMQTT();
  lastMsgMs = millis();
}

void loop() {
  // Reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  // Check for stale broker connection
  AlertSeverity sev = currentSeverity;
  if ((millis() - lastMsgMs) > STALE_MS) {
    sev = SEV_STALE;
  }

  // Render one frame of the current effect
  switch (sev) {
    case SEV_NONE:
      // Solid green — all healthy
      fillAll(CRGB(0, 200, 0));
      delay(100);
      break;

    case SEV_INFO:
      // Slow cyan pulse (breathe ~2 s)
      breatheEffect(CRGB(0, 200, 200), 2000);
      break;

    case SEV_WARNING:
      // Slow orange blink: 600 ms on, 800 ms off
      blinkEffect(CRGB(255, 100, 0), 600, 800);
      break;

    case SEV_CRITICAL:
      // Fast red blink: 250 ms on, 250 ms off
      blinkEffect(CRGB(255, 0, 0), 250, 250);
      break;

    case SEV_STALE:
      // Dim blue breathing — broker unreachable
      breatheEffect(CRGB(0, 0, 180), 3000);
      break;
  }
}
