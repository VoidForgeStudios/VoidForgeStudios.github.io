/* =========================================================
   VoidForge / BattleZone PlayerDB
   Firebase Auth + Firestore
   Classic browser script - NO ES MODULES
========================================================= */

(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  if (!window.firebase) {
    console.error(
      "[PlayerDB] Firebase SDK is not loaded."
    );
    return;
  }

  let app;

  try {
    app = firebase.app();
  } catch (error) {
    app = firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();


  /* =======================================================
     HELPERS
  ======================================================= */

  function cleanUsername(username) {
    return String(username || "")
      .trim()
      .replace(/\s+/g, " ");
  }


  function normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  }


  function validateUsername(username) {

    if (!username) {
      throw new Error("Username is required.");
    }

    if (username.length < 3) {
      throw new Error(
        "Username must contain at least 3 characters."
      );
    }

    if (username.length > 24) {
      throw new Error(
        "Username cannot contain more than 24 characters."
      );
    }

    if (!/^[a-zA-Z0-9_ -]+$/.test(username)) {
      throw new Error(
        "Username contains invalid characters."
      );
    }
  }


  /* =======================================================
     REGISTER
  ======================================================= */

  async function registerPlayer(
    username,
    email,
    password
  ) {

    username = cleanUsername(username);
    email = normalizeEmail(email);

    validateUsername(username);

    if (!email) {
      throw new Error("Email is required.");
    }

    if (!password || password.length < 6) {
      throw new Error(
        "Password must contain at least 6 characters."
      );
    }


    const result =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );


    const user = result.user;


    await user.updateProfile({
      displayName: username
    });


    await db
      .collection("players")
      .doc(user.uid)
      .set({

        uid: user.uid,

        username: username,

        usernameLower:
          username.toLowerCase(),

        email: email,

        level: 1,

        xp: 0,

        vbucks: 2850,

        wins: 0,

        matches: 0,

        kills: 0,

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        lastLogin:
          firebase.firestore.FieldValue
            .serverTimestamp()
      });


    return {
      uid: user.uid,
      username: username,
      email: email
    };
  }


  /* =======================================================
     LOGIN
  ======================================================= */

  async function loginPlayer(
    email,
    password
  ) {

    email = normalizeEmail(email);

    if (!email || !password) {
      throw new Error(
        "Email and password are required."
      );
    }


    const result =
      await auth.signInWithEmailAndPassword(
        email,
        password
      );


    const user = result.user;


    const ref =
      db
        .collection("players")
        .doc(user.uid);


    const snapshot =
      await ref.get();


    let player;


    if (snapshot.exists) {

      player = snapshot.data();


      await ref.set(
        {
          lastLogin:
            firebase.firestore.FieldValue
              .serverTimestamp()
        },
        {
          merge: true
        }
      );

    } else {

      player = {

        uid: user.uid,

        username:
          user.displayName || "PLAYER",

        email: user.email,

        level: 1,

        xp: 0,

        vbucks: 2850,

        wins: 0,

        matches: 0,

        kills: 0
      };


      await ref.set({

        ...player,

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        lastLogin:
          firebase.firestore.FieldValue
            .serverTimestamp()
      });
    }


    return player;
  }


  /* =======================================================
     CURRENT PLAYER
  ======================================================= */

  async function getCurrentPlayer() {

    const user = auth.currentUser;


    if (!user) {
      return null;
    }


    const snapshot =
      await db
        .collection("players")
        .doc(user.uid)
        .get();


    if (!snapshot.exists) {

      return {

        uid: user.uid,

        username:
          user.displayName || "PLAYER",

        email: user.email
      };
    }


    return snapshot.data();
  }


  /* =======================================================
     CURRENT USER
  ======================================================= */

  function getCurrentUser() {
    return auth.currentUser;
  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logoutPlayer() {
    await auth.signOut();
  }


  /* =======================================================
     AUTH STATE
  ======================================================= */

  function watchPlayer(callback) {

    return auth.onAuthStateChanged(
      async function (user) {

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
            "[PlayerDB] Error loading player:",
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


  /* =======================================================
     UPDATE PLAYER
  ======================================================= */

  async function updatePlayer(updates) {

    const user = auth.currentUser;


    if (!user) {
      throw new Error(
        "You are not logged in."
      );
    }


    const ref =
      db
        .collection("players")
        .doc(user.uid);


    const data = {
      ...updates,

      updatedAt:
        firebase.firestore.FieldValue
          .serverTimestamp()
    };


    if (updates.username) {

      const username =
        cleanUsername(
          updates.username
        );


      validateUsername(username);


      await user.updateProfile({
        displayName: username
      });


      data.username = username;

      data.usernameLower =
        username.toLowerCase();
    }


    await ref.set(
      data,
      {
        merge: true
      }
    );


    return getCurrentPlayer();
  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.PlayerDB = {

    app: app,

    auth: auth,

    db: db,

    registerPlayer:
      registerPlayer,

    loginPlayer:
      loginPlayer,

    getCurrentPlayer:
      getCurrentPlayer,

    getCurrentUser:
      getCurrentUser,

    logoutPlayer:
      logoutPlayer,

    watchPlayer:
      watchPlayer,

    updatePlayer:
      updatePlayer
  };


  console.log(
    "[PlayerDB] Firebase PlayerDB initialized."
  );

})();
