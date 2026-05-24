// Minimal Arduino stub — compiled only when using PlatformIO directly.
// The real firmware is generated and compiled by ESPHome from cloudless-watchdog.yaml.
// This file is here so `pio build` succeeds and IntelliSense can resolve headers.
#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  Serial.println("cloudless-watchdog stub — use ESPHome to build the real firmware");
}

void loop() {}

// Trigger re-analysis for SonarQube
