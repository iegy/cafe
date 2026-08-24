# القهوة v7

منصة ألعاب خاصة للأصحاب مبنية على GitHub Pages + Firebase Realtime Database + Anonymous Authentication.

## الألعاب
- دومينو القهوة: مبني على آخر إصدار من دومنو الصحبة، مع قواعد قياسية / مخصصة، السحب والإفلات، السحب العشوائي، خيار السحب التلقائي، ستايلات قطع، نقاط، شات وصوت.
- شطرنج القهوة: شطرنج 1×1 بقواعد كاملة تشمل النقلات القانونية، الكش والمات، التبييت، الأخذ بالتجاوز، ترقية البيدق، الستيل ميت، قاعدة 50 نقلة، التكرار ثلاث مرات، القطع غير الكافية، الاستسلام، عرض التعادل، الساعة، سجل النقلات، مراجعة الوضع السابق وPGN.

## الملفات الأساسية
- `index.html`: الصفحة الرئيسية لمنصة القهوة.
- `domino.html` + `domino-app.js` + `domino.css`.
- `chess.html` + `chess-app.js` + `chess.css`.
- `firebase-config.js`: إعداد Firebase الحالي.
- `turn-config.js`: إعداد Metered TURN الحالي للاتصال الصوتي.
- `database.rules.json`: قواعد Realtime Database الحالية وتدعم الغرف للعبتين.

## النشر
ارفع كل الملفات والمجلدات إلى نفس مسار GitHub Pages. لا تغيّر `firebase-config.js` أو `turn-config.js` إلا عند تدوير مفاتيح الخدمات.


## Update 8.0.0
- Chess now uses custom SVG piece sets (Classic, Slate, Wood, Royal).
- Piece theme can be changed live during play.
- Improved mobile presentation for chess pieces, promotion dialog, and side panels.


## v8.0 — Social Games Expansion
- كل الألعاب لاعبان فقط.
- إضافة Ludo ثنائية اللاعبين مع 4 أحجار، زهر، أمان، أكل، بيت ورمية إضافية.
- إضافة Backgammon/الطاولة بقواعد الحركة، البار، الأكل، إخراج الأحجار والدبل.
- إضافة XO بنمط 3×3 ونمط 5×5 (أربع علامات للفوز).
- الألعاب الجديدة تستخدم نفس Firebase rooms ونفس أكواد الغرف، مع شات وصوت WebRTC/TURN.
- تحسين الصفحة الرئيسية لتعرض 5 ألعاب.


## v8.1 — Solo Games Edition
- Removed Ludo and Backgammon.
- Kept and upgraded XO with X/O move sounds, win/draw audio, vibration and visual effects.
- Added 2048 as a fully local single-player game with swipe controls, undo, best score, autosave, audio and effects.
- Added Sudoku as a fully local single-player game with difficulty levels, notes, hints, timer, pause, autosave, best times, audio and completion effects.
