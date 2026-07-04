# BetaDrive – Configurator for ESP32‑C3 RC Vehicle

System sterowania i konfiguracji dla pojazdu RC oparty na **ESP32‑C3**, z panelem webowym do ustawiania parametrów urządzenia w czasie rzeczywistym.

## Skład projektu

- **Panel webowy** – React + TypeScript + Vite + Tailwind CSS (ciemny motyw, responsywny).
  - Komunikacja z ESP32 za pomocą **Web Serial API**.
  - Podstrony: Setup, Receiver, GPS, Servos, Pins, Motors.
- **Firmware ESP32‑C3** – podzielone na moduły w języku C/Arduino:
  - `firmware/firmware.ino` – główna pętla, inicjalizacja.
  - `firmware/config.h` – typy, stały, globalny stan.
  - `firmware/serial_comm.ino` – komunikacja z panelem, parsowanie poleceń.
  - `firmware/motor_logic.ino` – logika sterowania silnikiem szczotkowym (BTS7960).
  - `firmware/steering.ino` + `firmware/throttle.ino` – sterowanie kierownicą i gazem z odbiornika RC z **failsafe**.
  - `firmware/servo_logic.ino`, `firmware/receiver_logic.ino`, `firmware/gps_logic.ino` – pozostałe moduły.

## Konfiguracja i uruchomienie

### Frontend (panel webowy)

```sh
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego (http://localhost:5173)
npm run dev

# Budowanie wersji produkcyjnej (do katalogu `dist`)
npm run build

# Lintowanie kodu
npm run lint
```

### Firmware

Wgraj pliki z katalogu `firmware/` na płytkę ESP32‑C3 za pomocą Arduino IDE lub PlatformIO.
**Ważne**: ustaw prędkość transmisji UART na `115200` bps.

## Komunikacja z urządzeniem

Panel i ESP32 komunikują się za pomocą **Web Serial API**:
- W przeglądarce wybierz odpowiedni port COM.
- W większości przypadków system automatycznie nawiąże połączenie (auto‑connect).
- Panel wysyła polecenia, a firmware zwraca dane konfiguracyjne i telemetryczne.

### Podstawowe polecenia (przykładowe)

- `FULL_CONFIG` – pobierz całą konfigurację urządzenia.
- `PIN_TABLE` – pobierz mapowanie pinów GPIO.
- `GPS_SETTINGS` – pobierz ustawienia GPS.
- `MOTOR_CONFIG` – pobierz konfigurację silnika.
- Polecenia w formacie JSON (np. z podstrony **Motors**) są obsługiwane oddzielnie w `serial_comm.ino`.

## Główne funkcje panelu

- **Motors**: konfiguracja sterownika BTS7960, live test z *deadman switch* i *emergency stop*, ustawienia płynności oraz ochrony przekładni.
- **Receiver**: ustawienia kanałów RC (kierownica, gaz, kierunek), odwrócenie osi, wybór trybu jazdy.
- **GPS**: wyświetlanie pozycji na mapie, liczby satelitów, jakości sygnału i telemetrii (prędkość w km/h, wysokość).
- **Pins**: mapowanie pinów GPIO ESP32‑C3 na funkcje (servo, steering, throttle, itp.).

## Bezpieczeństwo

- **Failsafe dla `steering` i `throttle`**: jeśli nie ma świeżych danych z odbiornika przez 500 ms, urządzenie automatycznie wraca do pozycji neutralnej (kierownica na środek, gaz na 0).
- **Emergency Stop** w sekcji Motors: natychmiastowe zatrzymanie silnika i wyłączenie wyjść.
- **Deadman Switch** w testie silnika: po zwolnieniu suwaka wartość wraca do 0.

## Ostatnie poprawki

1. Dodano **failsafe** dla sterowania kierownicą i gazem z odbiornika RC (firmware/steering.ino, firmware/throttle.ino).
2. Naprawiono błąd jednostek GPS: zmieniono `cm/s` na `km/h` w UI (src/components/GpsPage.tsx).
3. Usunięto generowanie sztucznych satelitów w panelu – teraz wyświetlane są wyłącznie dane z realnego odbiornika GPS (src/hooks/useSerial.ts).
4. Aktualizowano dokumentację w README.md.

## Stos technologiczny

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS
- shadcn‑ui
- react‑leaflet (mapa)
- ESP32 Arduino Core
