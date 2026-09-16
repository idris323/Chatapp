import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  onDisconnect,
  set,
  remove,
  serverTimestamp as rtdbServerTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

// ============================================================
// فقط این قسمت را با Firebase Console خودت جایگزین کن.
// ============================================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDuuS7VLqhNLWuE8R5cD6PiSXYZUE5lXbA",
  authDomain: "onlineusers-d6390.firebaseapp.com",
  databaseURL: "https://onlineusers-d6390-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "onlineusers-d6390",
  storageBucket: "onlineusers-d6390.firebasestorage.app",
  messagingSenderId: "9444834275",
  appId: "1:9444834275:web:7b0ad8e15cd01372183ed6",
  measurementId: "G-1JME2CVE0D"
databaseURL: "https://onlineusers-d6390-default-rtdb.asia-southeast1.firebasedatabase.app/"

};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

const $ = (id) => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");
const loginForm = $("loginForm");
const signupForm = $("signupForm");
const loginTab = $("loginTab");
const signupTab = $("signupTab");
const usersList = $("usersList");
const messagesEl = $("messages");
const emptyChat = $("emptyChat");
const chatView = $("chatView");
const myName = $("myName");
const onlineCount = $("onlineCount");
const chatUserName = $("chatUserName");
const chatUserStatus = $("chatUserStatus");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");

let currentUser = null;
let myProfile = null;
let allUsers = [];
let presenceMap = {};
let selectedUser = null;
let unsubscribeUsers = null;
let unsubscribePresence = null;
let unsubscribeOwnPresence = null;
let ownConnectionRef = null;
let ownLastSeenRef = null;
let unsubscribeMessages = null;

function showToast(message, isError = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3500);
}

function showAuth(mode = "login") {
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  signupForm.classList.toggle("hidden", isLogin);
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
}

loginTab.addEventListener("click", () => showAuth("login"));
signupTab.addEventListener("click", () => showAuth("signup"));

function cleanText(value) {
  return String(value ?? "").trim();
}

function fullName(profile) {
  return `${cleanText(profile?.firstName)} ${cleanText(profile?.lastName)}`.trim() || "کاربر";
}

function initials(profile) {
  const a = cleanText(profile?.firstName);
  const b = cleanText(profile?.lastName);
  return `${a.charAt(0)}${b.charAt(0)}` || "؟";
}

function firebaseError(code) {
  const map = {
    "auth/email-already-in-use": "این ایمیل قبلاً ثبت شده است.",
    "auth/invalid-email": "ایمیل واردشده معتبر نیست.",
    "auth/weak-password": "رمز عبور ضعیف است.",
    "auth/invalid-credential": "ایمیل یا رمز عبور اشتباه است.",
    "auth/user-not-found": "حسابی با این ایمیل پیدا نشد.",
    "auth/wrong-password": "رمز عبور اشتباه است.",
    "auth/too-many-requests": "تعداد تلاش‌ها زیاد شده؛ کمی بعد دوباره امتحان کنید.",
    "auth/network-request-failed": "اتصال اینترنت را بررسی کنید.",
    "auth/missing-password": "رمز عبور را وارد کنید."
  };
  return map[code] || `خطای Firebase: ${code}`;
}

async function createProfile(user, firstName, lastName) {
  const profileRef = doc(db, "users", user.uid);
  const profile = {
    uid: user.uid,
    firstName: cleanText(firstName),
    lastName: cleanText(lastName),
    createdAt: serverTimestamp()
  };
  await setDoc(profileRef, profile, { merge: true });
}

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const firstName = cleanText($("signupFirstName").value);
  const lastName = cleanText($("signupLastName").value);
  const email = cleanText($("signupEmail").value).toLowerCase();
  const password = $("signupPassword").value;
  const password2 = $("signupPassword2").value;

  if (firstName.length < 2) return showToast("نام را درست وارد کنید.", true);
  if (lastName.length < 1) return showToast("تخلص را وارد کنید.", true);
  if (password.length < 6) return showToast("رمز عبور باید حداقل ۶ حرف باشد.", true);
  if (password !== password2) return showToast("تکرار رمز عبور یکسان نیست.", true);

  try {
    signupForm.querySelector("button[type=submit]").disabled = true;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(credential.user, firstName, lastName);
    showToast("حساب با موفقیت ساخته شد.");
    signupForm.reset();
  } catch (error) {
    console.error(error);
    showToast(firebaseError(error.code), true);
  } finally {
    signupForm.querySelector("button[type=submit]").disabled = false;
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = cleanText($("loginEmail").value).toLowerCase();
  const password = $("loginPassword").value;
  try {
    loginForm.querySelector("button[type=submit]").disabled = true;
    await signInWithEmailAndPassword(auth, email, password);
    showToast("ورود موفق بود.");
  } catch (error) {
    console.error(error);
    showToast(firebaseError(error.code), true);
  } finally {
    loginForm.querySelector("button[type=submit]").disabled = false;
  }
});

$("resetPasswordBtn").addEventListener("click", async () => {
  const email = cleanText($("loginEmail").value).toLowerCase();
  if (!email) return showToast("اول ایمیل را وارد کنید.", true);
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("لینک تغییر رمز به ایمیل شما ارسال شد.");
  } catch (error) {
    console.error(error);
    showToast(firebaseError(error.code), true);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await stopOwnPresence();
  await signOut(auth);
});

function chatIdFor(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

async function ensureChatRoom(otherUid) {
  const id = chatIdFor(currentUser.uid, otherUid);
  const roomRef = doc(db, "chats", id);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      members: [currentUser.uid, otherUid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: ""
    });
  }
  return id;
}

function formatTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return "اکنون";
  return new Intl.DateTimeFormat("fa-AF", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp.toDate());
}

function updateChatHeader() {
  if (!selectedUser) return;
  const p = presenceMap[selectedUser.uid] || {};
  chatUserName.textContent = fullName(selectedUser);
  const online = isUserOnline(selectedUser.uid);
  chatUserStatus.textContent = online ? "● آنلاین" : "● آفلاین";
  chatUserStatus.classList.toggle("online-text", online);
}

function renderUsers() {
  const others = allUsers
    .filter(u => u.uid !== currentUser?.uid)
    .sort((a, b) => {
      const oa = presenceMap[a.uid]?.online === true ? 1 : 0;
      const ob = presenceMap[b.uid]?.online === true ? 1 : 0;
      return ob - oa || fullName(a).localeCompare(fullName(b), "fa");
    });

  const count = others.filter(u => isUserOnline(u.uid)).length;
  onlineCount.textContent = `${count.toLocaleString("fa-AF")} آنلاین`;

  if (others.length === 0) {
    usersList.innerHTML = '<div class="empty-state">فعلاً کاربر دیگری وجود ندارد.</div>';
    return;
  }

  usersList.innerHTML = others.map(user => {
    const p = presenceMap[user.uid] || {};
    const online = isUserOnline(selectedUser.uid);
    const active = selectedUser?.uid === user.uid ? " active" : "";
    return `
      <button class="user-item${active}" data-uid="${user.uid}">
        <span class="avatar">
          ${escapeHtml(initials(user))}
          <span class="online-dot${online ? " online" : ""}"></span>
        </span>
        <span class="user-main">
          <span class="user-name">${escapeHtml(fullName(user))}</span>
          <span class="user-status${online ? " online-text" : ""}">${online ? "آنلاین" : "آفلاین"}</span>
        </span>
      </button>
    `;
  }).join("");

  usersList.querySelectorAll(".user-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const user = allUsers.find(u => u.uid === btn.dataset.uid);
      if (user) openChat(user);
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function openChat(user) {
  selectedUser = user;
  emptyChat.classList.add("hidden");
  chatView.classList.remove("hidden");
  updateChatHeader();
  renderUsers();
  messagesEl.innerHTML = '<div class="empty-state">در حال بارگذاری پیام‌ها...</div>';
  messageInput.focus();

  if (unsubscribeMessages) unsubscribeMessages();

  try {
    const chatId = await ensureChatRoom(user.uid);
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const docs = [];
      snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return at - bt;
      });
      renderMessages(docs);
    }, (error) => {
      console.error(error);
      showToast("پیام‌ها قابل دریافت نیستند. Security Rules را بررسی کنید.", true);
    });
  } catch (error) {
    console.error(error);
    showToast("ساخت گفت‌وگو موفق نشد.", true);
  }
}

function renderMessages(docs) {
  if (docs.length === 0) {
    messagesEl.innerHTML = '<div class="empty-state">هنوز پیامی وجود ندارد. اولین پیام را بفرستید.</div>';
    return;
  }

  messagesEl.innerHTML = docs.map(msg => {
    const mine = msg.senderId === currentUser.uid;
    return `
      <div class="bubble-row ${mine ? "mine" : "theirs"}">
        <div class="bubble ${mine ? "mine" : "theirs"}">
          <div>${escapeHtml(msg.text)}</div>
          <div class="bubble-time">${formatTime(msg.createdAt)}</div>
        </div>
      </div>
    `;
  }).join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !selectedUser) return;
  const text = cleanText(messageInput.value);
  if (!text) return;

  try {
    sendBtn.disabled = true;
    const chatId = await ensureChatRoom(selectedUser.uid);
    const roomRef = doc(db, "chats", chatId);
    const messagesRef = collection(db, "chats", chatId, "messages");

    await addDoc(messagesRef, {
      senderId: currentUser.uid,
      receiverId: selectedUser.uid,
      text,
      createdAt: serverTimestamp()
    });

    await updateDoc(roomRef, {
      lastMessage: text.slice(0, 200),
      updatedAt: serverTimestamp()
    });

    messageInput.value = "";
    messageInput.focus();
  } catch (error) {
    console.error(error);
    showToast("پیام ارسال نشد. Firestore Rules را بررسی کنید.", true);
  } finally {
    sendBtn.disabled = false;
  }
});

function startUsersListener() {
  if (unsubscribeUsers) unsubscribeUsers();
  const usersRef = collection(db, "users");
  unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
    allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const currentProfile = allUsers.find(u => u.uid === currentUser.uid);
    if (currentProfile) {
      myProfile = currentProfile;
      myName.textContent = fullName(currentProfile);
      updateChatHeader();
    }
    renderUsers();
  }, (error) => {
    console.error(error);
    usersList.innerHTML = '<div class="empty-state">خطا در دریافت کاربران.</div>';
    showToast("کاربران دریافت نشدند؛ Firestore Rules را بررسی کنید.", true);
  });
}

function startPresenceListener() {
  if (unsubscribePresence) unsubscribePresence();
  const statusRef = ref(rtdb, "status");
  unsubscribePresence = onValue(statusRef, (snapshot) => {
    presenceMap = snapshot.val() || {};
    renderUsers();
    updateChatHeader();
  }, (error) => {
    console.error(error);
    showToast("وضعیت آنلاین دریافت نشد؛ Realtime Database Rules را بررسی کنید.", true);
  });
}

function isUserOnline(uid) {
  const status = presenceMap[uid];
  return !!(status && status.connections && Object.keys(status.connections).length > 0);
}

async function startOwnPresence(user) {
  const connectedRef = ref(rtdb, ".info/connected");
  const connectionsRef = ref(rtdb, `status/${user.uid}/connections`);
  ownConnectionRef = push(connectionsRef);
  ownLastSeenRef = ref(rtdb, `status/${user.uid}/lastSeen`);

  if (unsubscribeOwnPresence) unsubscribeOwnPresence();
  unsubscribeOwnPresence = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true || !ownConnectionRef) return;
    try {
      // Register cleanup on Firebase's server before marking this tab online.
      await onDisconnect(ownConnectionRef).remove();
      await onDisconnect(ownLastSeenRef).set(rtdbServerTimestamp());
      await set(ownConnectionRef, rtdbServerTimestamp());
    } catch (error) {
      console.error("presence error", error);
    }
  });
}

async function stopOwnPresence() {
  if (unsubscribeOwnPresence) {
    unsubscribeOwnPresence();
    unsubscribeOwnPresence = null;
  }
  if (ownConnectionRef) {
    try {
      await remove(ownConnectionRef);
      if (ownLastSeenRef) await set(ownLastSeenRef, rtdbServerTimestamp());
    } catch (error) {
      console.warn("presence cleanup failed", error);
    }
  }
  ownConnectionRef = null;
  ownLastSeenRef = null;
}

onAuthStateChanged(auth, async (user) => {
  if (unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
  if (unsubscribePresence) { unsubscribePresence(); unsubscribePresence = null; }
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
  if (!user) await stopOwnPresence();

  currentUser = user;
  selectedUser = null;
  presenceMap = {};
  allUsers = [];

  if (!user) {
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    showAuth("login");
    return;
  }

  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  emptyChat.classList.remove("hidden");
  chatView.classList.add("hidden");
  messagesEl.innerHTML = "";

  startUsersListener();
  startPresenceListener();
  await startOwnPresence(user);
});
