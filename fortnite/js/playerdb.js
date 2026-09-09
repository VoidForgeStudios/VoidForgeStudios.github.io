// ./js/playerdb.js

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ========================================================
// FIREBASE CONFIG
// ========================================================
//
// Get this from:
// Firebase Console
// → Project settings
// → Your apps
// → Web app
//
// ========================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};


// ========================================================
// INITIALIZE FIREBASE
// ========================================================

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);


// ========================================================
// CREATE PLAYER
// ========================================================

export async function registerPlayer(
  username,
  email,
  password
) {

  username = String(username).trim();
  email = String(email).trim().toLowerCase();

  if (!username) {
    throw new Error("Username is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (password.length < 6) {
    throw new Error(
      "Password must contain at least 6 characters."
    );
  }


  // Create Firebase Authentication account
  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  const user = credential.user;


  // Set Firebase display name
  await updateProfile(user, {
    displayName: username
  });


  // Create Firestore player document
  await setDoc(
    doc(db, "players", user.uid),
    {
      uid: user.uid,
      username: username,
      email: email,

      level: 1,
      xp: 0,

      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    }
  );


  return {
    uid: user.uid,
    username: username,
    email: email
  };
}


// ========================================================
// LOGIN
// ========================================================
//
// Your index.html can call:
//
// await loginPlayer(email, password)
//
// ========================================================

export async function loginPlayer(
  email,
  password
) {

  email = String(email).trim().toLowerCase();

  if (!email || !password) {
    throw new Error(
      "Email and password are required."
    );
  }


  const credential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  const user = credential.user;


  // Get player profile
  const playerRef =
    doc(db, "players", user.uid);

  const playerSnap =
    await getDoc(playerRef);


  let username =
    user.displayName || "PLAYER";


  if (playerSnap.exists()) {

    const data =
      playerSnap.data();

    if (data.username) {
      username = data.username;
    }


    // Update last login
    await setDoc(
      playerRef,
      {
        lastLogin: serverTimestamp()
      },
      {
        merge: true
      }
    );

  }


  return {
    uid: user.uid,
    username: username,
    email: user.email
  };
}


// ========================================================
// GET CURRENT PLAYER
// ========================================================

export async function getCurrentPlayer() {

  const user = auth.currentUser;

  if (!user) {
    return null;
  }


  const playerRef =
    doc(db, "players", user.uid);

  const playerSnap =
    await getDoc(playerRef);


  if (!playerSnap.exists()) {

    return {
      uid: user.uid,
      username:
        user.displayName || "PLAYER",
      email: user.email
    };

  }


  return {
    uid: user.uid,
    ...playerSnap.data()
  };
}


// ========================================================
// GET CURRENT FIREBASE USER
// ========================================================

export function getCurrentUser() {
  return auth.currentUser;
}


// ========================================================
// LOGOUT
// ========================================================

export async function logoutPlayer() {

  await signOut(auth);

}


// ========================================================
// AUTH STATE LISTENER
// ========================================================

export function watchPlayer(callback) {

  return onAuthStateChanged(
    auth,
    async user => {

      if (!user) {
        callback(null);
        return;
      }


      try {

        const player =
          await getCurrentPlayer();

        callback(player);

      } catch (error) {

        console.error(
          "Failed to load player:",
          error
        );

        callback({
          uid: user.uid,
          username:
            user.displayName || "PLAYER",
          email: user.email
        });

      }

    }
  );
}


// ========================================================
// UPDATE PLAYER PROFILE
// ========================================================

export async function updatePlayer(
  updates
) {

  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You are not logged in."
    );
  }


  const playerRef =
    doc(db, "players", user.uid);


  await setDoc(
    playerRef,
    {
      ...updates,
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );


  if (updates.username) {

    await updateProfile(user, {
      displayName: updates.username
    });

  }


  return getCurrentPlayer();
}


// ========================================================
// CHECK USERNAME
// ========================================================
//
// Useful when creating accounts.
// ========================================================

export async function usernameExists(
  username
) {

  username =
    String(username)
      .trim()
      .toLowerCase();


  // This requires a Firestore query if you want
  // globally unique usernames.
  //
  // For now this function returns false.
  //
  // We can add a usernames collection for proper
  // uniqueness.

  return false;
}
