# وكيل KALTRON الإصدار 1.0.0

KALTRON واجهة صوتية ومتصفح عربية لنظام Hermes Agent على ويندوز. يستخدم Whisper متعدد اللغات للصوت الوارد وEdge TTS بصوت `ar-JO-TaimNeural` للصوت العربي.

## الوضع الآمن الافتراضي

يعمل HUD محلياً على `127.0.0.1:8766`. الواجهة الافتراضية خفيفة ولا تشغّل WebGL أو Three.js. اتصال الشبكة المحلية معطل حتى اكتمال مراجعة الجدار الناري.

## التثبيت والتشغيل

1. شغّل `installer\kaltron-installer.ps1` من PowerShell.
2. شغّل `kaltron-start.bat`.
3. افتح `https://localhost:8766/hud/`.
4. أوقف KALTRON فقط بواسطة `kaltron-stop.bat`.
5. افحص المكونات بواسطة `kaltron-health.bat`.

ينشئ المثبّت نسخة احتياطية من `.env` و`config.yaml` قبل تعديل مفاتيح KALTRON الثلاثة فقط. لا يغيّر Telegram أو مهام cron.
