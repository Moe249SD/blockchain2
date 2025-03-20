const contractAddress = "0x62130C6bcfD070EdB9BcFfEdeb234ec045cB6720"; // ضع عنوان العقد هنا
const abi = 
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
];

async function connectWallet() {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });
            console.log("✅ MetaMask متصل");
        } catch (error) {
            console.error("❌ فشل الاتصال بـ MetaMask:", error);
        }
    } else {
        console.log("❌ يرجى تثبيت MetaMask!");
    }
}

async function storeDocument() {
    if (!window.ethereum) {
        return console.log("❌ يرجى تثبيت MetaMask!");
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    const documentText = document.getElementById("documentInput").value;
    if (!documentText) {
        return alert("❌ الرجاء إدخال نص المستند!");
    }

    const documentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(documentText));
    console.log("📌 تجزئة المستند:", documentHash);

    try {
        const tx = await contract.storeDocument(documentHash);
        await tx.wait();
        alert("✅ تم تخزين المستند بنجاح!");
    } catch (error) {
        console.error("❌ خطأ أثناء تخزين المستند:", error);
    }
}

async function verifyDocument() {
    if (!window.ethereum) {
        return console.log("❌ يرجى تثبيت MetaMask!");
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const documentText = document.getElementById("documentInput").value;
    if (!documentText) {
        return alert("❌ الرجاء إدخال نص المستند!");
    }

    const documentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(documentText));
    console.log("📌 تجزئة المستند:", documentHash);

    try {
        const isStored = await contract.verifyDocument(documentHash);
        alert(isStored ? "✅ المستند موجود في البلوكشين!" : "❌ المستند غير موجود!");
    } catch (error) {
        console.error("❌ خطأ أثناء التحقق من المستند:", error);
    }
}
