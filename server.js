require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Web3 } = require('web3')
const crypto = require('crypto');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');

// إنشاء تطبيق Express
const app = express();
const port = process.env.PORT || 5000;

// إعداد Web3.js
const web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545');
const contractABI = [
  [
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "storeDocument",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "verifyDocument",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
];
const contractAddress = process.env.CONTRACT_ADDRESS; // تأكد من تعريفها في .env
const contract = new web3.eth.Contract(contractABI, contractAddress);

// الاتصال بـ MongoDB باستخدام MONGO_URI من .env
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// إنشاء نموذج المستخدم
const User = require('./models/User');

// تهيئة GridFS
const conn = mongoose.createConnection(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
  console.log("✅ GridFS جاهز للاستخدام.");
});


// إعداد تخزين الملفات في MongoDB باستخدام GridFS
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  options: { useNewUrlParser: true, useUnifiedTopology: true }
});
const upload = multer({ storage });

// إعداد محرك القوالب EJS
app.set('view engine', 'ejs');

// إتاحة الملفات الثابتة (CSS, JS)
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secretKey', resave: false, saveUninitialized: true }));

// رفع الملفات
app.post('/metamask-login', async (req, res) => {
    const { address, signature } = req.body;

    if (!address || !signature) {
        return res.status(400).json({ success: false, message: "❌ عنوان المحفظة أو التوقيع غير موجودين" });
    }

    try {
        const message = `تسجيل الدخول: ${address}`;
        const recoveredAddress = web3.eth.accounts.recover(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            req.session.user = { address };
            return res.json({ success: true, message: "✅ تسجيل الدخول ناجح", address });
        } else {
            return res.status(401).json({ success: false, message: "❌ فشل التحقق من التوقيع" });
        }
    } catch (err) {
        console.error("❌ خطأ أثناء تسجيل الدخول:", err);
        return res.status(500).json({ success: false, message: "❌ خطأ غير متوقع" });
    }
});

// رفع الملفات وحساب التجزئة باستخدام SHA-256
app.post('/upload', upload.single('file'), async (req, res) => {
    const fileCursor = gfs.find({ filename: req.file.filename });
    const filesArray = await fileCursor.toArray();
    const file = filesArray[0];

    if (!file) {
        return res.status(400).send("❌ لم يتم العثور على الملف");
    }

    const fileStream = gfs.createReadStream(file.filename);
    const hash = crypto.createHash('sha256');

    fileStream.on('data', (chunk) => {
        hash.update(chunk);
    });

    fileStream.on('end', async () => {
        const fileHash = hash.digest('hex');

        try {
            const accounts = await web3.eth.getAccounts();
            await contract.methods.storeDocument(fileHash).send({ from: accounts[0] });
            res.redirect('/dashboard');
        } catch (err) {
            console.error("❌ خطأ أثناء تخزين التجزئة:", err);
            res.status(500).send("❌ خطأ أثناء تأمين المستند في البلوكشين");
        }
    });
});

// التحقق من الوثائق
app.post('/verify', async (req, res) => {
  const fileHash = req.body.hash;

  try {
    const isStored = await contract.methods.verifyDocument(fileHash).call();
    if (isStored) {
      res.send("✅ المستند أصلي ومخزن في البلوكشين");
    } else {
      res.send("❌ المستند غير موجود في البلوكشين");
    }
  } catch (err) {
    res.status(500).send("❌ خطأ أثناء التحقق");
  }
});

// تسجيل مستخدم جديد
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    res.status(500).send("❌ خطأ في تسجيل المستخدم");
  }
});

// تسجيل الدخول
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("❌ المستخدم غير موجود");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("❌ كلمة المرور غير صحيحة");

    req.session.user = user;
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send("❌ خطأ في تسجيل الدخول");
  }
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// عرض صفحات التسجيل وتسجيل الدخول
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

// الصفحة الرئيسية
app.get('/', (req, res) => res.render('index'));

// لوحة التحكم بعد تسجيل الدخول
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('dashboard', { user: req.session.user });
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});


// تشغيل السيرفر
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});