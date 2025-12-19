// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDn3dGe2dhgfrqwYENgWA1biEW8ngXv068",
    authDomain: "office-manager-pro-1b6ae.firebaseapp.com",
    projectId: "office-manager-pro-1b6ae",
    storageBucket: "office-manager-pro-1b6ae.firebasestorage.app",
    messagingSenderId: "202156442292",
    appId: "1:202156442292:web:664d17e9c8e75535168de1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;
let userRole = null;

// --- AUTH FUNCTIONS ---
async function signInWithGoogle(role) {
    try {
        // Switching to Redirect to avoid the popup error you saw
        await auth.signInWithRedirect(googleProvider);
        // Note: We handle the result in onAuthStateChanged
        localStorage.setItem('pendingRole', role); 
    } catch (err) { alert(err.message); }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        let userDoc = await db.collection('users').doc(user.uid).get();

        if (!userDoc.exists) {
            const role = localStorage.getItem('pendingRole') || 'poster';
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                role: role,
                uid: user.uid,
                photo: user.photoURL
            });
            userRole = role;
        } else {
            userRole = userDoc.data().role;
        }
        
        document.getElementById('user-photo').innerHTML = `<img src="${user.photoURL}">`;
        showDashboard();
    } else {
        showAuth();
    }
});

// --- DASHBOARD LOGIC ---
function showDashboard() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('display-role').innerText = userRole;
    if(userRole === 'poster') {
        document.getElementById('view-poster').classList.remove('hidden');
        loadPosterErrands();
    } else {
        document.getElementById('view-runner').classList.remove('hidden');
        loadAllErrands();
    }
}

// --- POSTER FUNCTIONS ---
async function createNewErrand() {
    const title = document.getElementById('tTitle').value;
    const loc = document.getElementById('tLoc').value;
    if(!title || !loc) return alert("Fill all fields");
    await db.collection('errands').add({
        title, location: loc, posterId: currentUser.uid, status: 'OPEN', createdAt: new Date()
    });
    document.getElementById('tTitle').value = ''; document.getElementById('tLoc').value = '';
}

function loadPosterErrands() {
    db.collection('errands').where('posterId', '==', currentUser.uid).orderBy('createdAt','desc').onSnapshot(snap => {
        const list = document.getElementById('my-errands-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `
                <div class="bg-white p-5 rounded-2xl border shadow-sm">
                    <h3 class="font-bold">${data.title}</h3>
                    <p class="text-xs text-gray-400">Status: ${data.status}</p>
                    <div id="bids-${doc.id}" class="mt-3 pt-3 border-t text-[10px] text-gray-400 uppercase font-bold">
                        Waiting for bids...
                    </div>
                </div>`;
            loadBidsForPoster(doc.id);
        });
    });
}

function loadBidsForPoster(errandId) {
    db.collection('bids').where('errandId', '==', errandId).onSnapshot(snap => {
        const bidDiv = document.getElementById(`bids-${errandId}`);
        if(snap.empty) return;
        bidDiv.innerHTML = "<p class='mb-2 text-green-600'>Runner Bids:</p>";
        snap.forEach(doc => {
            const bid = doc.data();
            bidDiv.innerHTML += `
                <div class="flex justify-between items-center bg-green-50 p-2 rounded-lg border">
                    <span class="font-bold">KES ${bid.amount}</span>
                    <button onclick="acceptBid('${errandId}', '${doc.id}', ${bid.amount})" class="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold">ACCEPT</button>
                </div>`;
        });
    });
}

// --- RUNNER FUNCTIONS ---
function loadAllErrands() {
    db.collection('errands').where('status', '==', 'OPEN').onSnapshot(snap => {
        const list = document.getElementById('all-errands-list');
        list.innerHTML = snap.empty ? "<p class='py-10 text-gray-400'>No jobs available.</p>" : "";
        snap.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `
                <div class="bg-white p-5 rounded-2xl border text-left shadow-sm">
                    <h3 class="font-bold text-lg">${data.title}</h3>
                    <p class="text-green-600 text-xs font-bold mb-4 italic">📍 ${data.location}</p>
                    <div class="flex gap-2 border-t pt-4">
                        <input type="number" id="amt-${doc.id}" placeholder="KES" class="w-full p-2 bg-gray-50 rounded-lg text-sm border">
                        <button onclick="placeBid('${doc.id}')" class="bg-black text-white px-6 py-2 rounded-lg text-sm font-black">BID</button>
                    </div>
                </div>`;
        });
    });
}

async function placeBid(errandId) {
    const amt = document.getElementById(`amt-${errandId}`).value;
    if(!amt) return alert("Enter amount");
    await db.collection('bids').add({ errandId, amount: Number(amt), runnerId: currentUser.uid });
    alert("Bid sent!");
}

async function acceptBid(errandId, bidId, amount) {
    if(confirm(`Accept bid for KES ${amount}?`)) {
        await db.collection('errands').doc(errandId).update({
            status: 'PENDING_PAYMENT', finalPrice: amount, acceptedBidId: bidId
        });
        alert("Payment logic is next!");
    }
}

function logout() { auth.signOut(); location.reload(); }
function showAuth() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('dashboard').classList.add('hidden'); }
