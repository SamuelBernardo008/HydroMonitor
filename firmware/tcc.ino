#include <Servo.h>

// Pinos
const int TRIG = 12, ECHO = 11;
const int LED_R = 6, LED_G = 5, LED_B = 3, LED_BRANCO = 9;
const int SERVO_PIN = 7, BUZZER_PIN = 4;
const int BTN_MUTE = 2, BTN_SERVO = 8, LDR_PIN = A0;

Servo meuServo;

// Variáveis de estado
bool alarmeSilenciado = false;
bool controleManualAtivo = false;
bool posicaoServoManual = false;
bool btnMuteAnt = LOW, btnServoAnt = LOW;
int nivelAnterior = -1;
int anguloServoAnterior = -1;

const int LIMIAR_LUZ = 150;
unsigned long ultimoEnvioSerial = 0;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(LED_BRANCO, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BTN_MUTE, INPUT);
  pinMode(BTN_SERVO, INPUT);

  meuServo.attach(SERVO_PIN);
  meuServo.write(90);
  anguloServoAnterior = 90;

  Serial.begin(9600);
}

void loop() {
  // 0. Leitura de Comandos Vindos do Raspberry Pi (Python)
  if (Serial.available() > 0) {
    char comando = Serial.read();
    if (comando == 'M') {
      alarmeSilenciado = true;
    } else if (comando == 'S') {
      if (!controleManualAtivo) {
        controleManualAtivo = true;
        posicaoServoManual = true; // Força nova posição no primeiro clique remoto
      } else {
        posicaoServoManual = !posicaoServoManual;
      }
    }
  }

  // 1. LED Branco via LDR
  int leituraLDR = analogRead(LDR_PIN);
  digitalWrite(LED_BRANCO, leituraLDR > LIMIAR_LUZ ? HIGH : LOW);

  // 2. Leitura do Botão Mute Físico
  bool btnMuteAtual = digitalRead(BTN_MUTE);
  if (btnMuteAnt == LOW && btnMuteAtual == HIGH) {
    alarmeSilenciado = true;
    delay(50);
  }
  btnMuteAnt = btnMuteAtual;

  // 3. Leitura de Distância (Ultrassônico com timeout de 30ms para não travar)
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duracao = pulseIn(ECHO, HIGH, 30000);
  float dist = (duracao > 0) ? (duracao * 0.0343) / 2.0 : 0.0;

  // Determina o Nível de Água (1: Verde, 2: Amarelo, 3: Vermelho)
  int nivelAtual = 0;
  if (dist > 0 && dist <= 10) nivelAtual = 1;
  else if (dist > 10 && dist <= 20) nivelAtual = 2;
  else if (dist > 20 && dist <= 30) nivelAtual = 3;

  // Reseta para automático se o nível mudar
  if (nivelAtual != nivelAnterior) {
    controleManualAtivo = false;
    nivelAnterior = nivelAtual;
  }

  // 4. Leitura do Botão Servo Físico
  bool btnServoAtual = digitalRead(BTN_SERVO);
  if (btnServoAnt == LOW && btnServoAtual == HIGH) {
    if (!controleManualAtivo) {
      controleManualAtivo = true;
      posicaoServoManual = (nivelAtual == 3);
    } else {
      posicaoServoManual = !posicaoServoManual;
    }
    delay(50);
  }
  btnServoAnt = btnServoAtual;

  // 5. LED RGB e Buzzer Alarme
  if (nivelAtual == 1) {
    definirCorRGB(0, 255, 0);   // Verde
    noTone(BUZZER_PIN);
    alarmeSilenciado = false;
  }
  else if (nivelAtual == 2) {
    definirCorRGB(255, 255, 0); // Amarelo
    noTone(BUZZER_PIN);
    alarmeSilenciado = false;
  }
  else if (nivelAtual == 3) {
    definirCorRGB(255, 0, 0);   // Vermelho
    if (!alarmeSilenciado) tone(BUZZER_PIN, 1000);
    else noTone(BUZZER_PIN);
  }
  else {
    definirCorRGB(0, 0, 0);     // Fora de alcance
    noTone(BUZZER_PIN);
    alarmeSilenciado = false;
  }

  // 6. Controle e Bip do Servo
  int anguloAlvo = controleManualAtivo ? (posicaoServoManual ? 0 : 90) : (nivelAtual == 3 ? 90 : 0);

  if (anguloAlvo != anguloServoAnterior) {
    meuServo.write(anguloAlvo);
    tone(BUZZER_PIN, 1800);
    delay(80);

    if (nivelAtual != 3 || alarmeSilenciado) {
      noTone(BUZZER_PIN);
    }
    anguloServoAnterior = anguloAlvo;
  }

  // 7. Envio dos Dados JSON via Serial (a cada 500ms)
  if (millis() - ultimoEnvioSerial >= 500) {
    ultimoEnvioSerial = millis();

    Serial.print("{\"distancia_cm\":");
    Serial.print(dist, 1);
    Serial.print(",\"luz\":");
    Serial.print(leituraLDR);
    Serial.print(",\"nivel\":");
    Serial.print(nivelAtual);
    Serial.print(",\"alarme_silenciado\":");
    Serial.print(alarmeSilenciado ? "true" : "false");
    Serial.print(",\"modo_manual\":");
    Serial.print(controleManualAtivo ? "true" : "false");
    Serial.print(",\"servo_angulo\":");
    Serial.print(anguloAlvo);
    Serial.println("}");
  }

  delay(50);
}

void definirCorRGB(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

