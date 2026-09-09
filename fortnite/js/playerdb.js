/* =========================================================
   VoidForge / BattleZone PlayerDB
   Firebase Auth + Firestore
   Classic browser script

   FIXED:
   - watchPlayer()
   - safer player loading
   - better error logging
   - avoids unnecessary lastLogin write inside watchPlayer
========================================================= */

(function () {
  "use strict";


  /* =======================================================
     FIREBASE CONFIG
  ======================================================= */

  const firebaseConfig = {

    apiKey: "AIzaSyCigGCB83OCay67rudCX5vH-goxHAorC1c",

    authDomain:
      "battlezone-a01dd.firebaseapp.com",

    projectId:
      "battlezone-a01dd",

    storageBucket:
      "battlezone-a01dd.firebasestorage.app",

    messagingSenderId:
      "308958906592",

    appId:
      "1:308958906592:web:ce91f3d0e35f212598a885",

    measurementId:
      "G-ZJTKHQ5TLH"

  };


  /* =======================================================
     CHECK FIREBASE
  ======================================================= */

  if (!window.firebase) {

    console.error(
      "[PlayerDB] Firebase SDK is not loaded."
    );

    return;
  }


  /* =======================================================
     INITIALIZE FIREBASE
  ======================================================= */

  let app;

  try {

    app = firebase.app();

  } catch (error) {

    app =
      firebase.initializeApp(firebaseConfig);

  }


  const auth =
    firebase.auth();

  const db =
    firebase.firestore();


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


  function usernameKey(username) {

    return cleanUsername(username)
      .toLowerCase();

  }


  function validateUsername(username) {

    if (!username) {

      throw new Error(
        "Username is required."
      );

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

    username =
      cleanUsername(username);

    email =
      normalizeEmail(email);


    validateUsername(username);


    if (!email) {

      throw new Error(
        "Email is required."
      );

    }


    if (!password || password.length < 6) {

      throw new Error(
        "Password must contain at least 6 characters."
      );

    }


    /*
      Check whether username already exists.
    */

    const existing =
      await db
        .collection("players")
        .where(
          "usernameLower",
          "==",
          usernameKey(username)
        )
        .limit(1)
        .get();


    if (!existing.empty) {

      throw new Error(
        "That username is already taken."
      );

    }


    /*
      Create Firebase Auth account.
    */

    const result =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );


    const user =
      result.user;


    /*
      Set Firebase display name.
    */

    await user.updateProfile({

      displayName:
        username

    });


    /*
      Create PlayerDB document.
    */

    await db
      .collection("players")
      .doc(user.uid)
      .set({

        uid:
          user.uid,

        username:
          username,

        usernameLower:
          usernameKey(username),

        email:
          email,

        level:
          1,

        xp:
          0,

        vbucks:
          2850,

        wins:
          0,

        matches:
          0,

        kills:
          0,

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        lastLogin:
          firebase.firestore.FieldValue
            .serverTimestamp()

      });


    return {

      uid:
        user.uid,

      username:
        username,

      email:
        email

    };

  }


  /* =======================================================
     LOGIN BY EMAIL
  ======================================================= */

  async function loginPlayer(
    email,
    password
  ) {

    email =
      normalizeEmail(email);


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


    return loadPlayerFromAuthUser(
      result.user
    );

  }


  /* =======================================================
     LOGIN BY USERNAME
  ======================================================= */

  async function loginWithUsername(
    username,
    password
  ) {

    username =
      cleanUsername(username);


    if (!username || !password) {

      throw new Error(
        "Username and password are required."
      );

    }


    /*
      Find player by username.
    */

    const snapshot =
      await db
        .collection("players")
        .where(
          "usernameLower",
          "==",
          usernameKey(username)
        )
        .limit(1)
        .get();


    if (snapshot.empty) {

      throw new Error(
        "Player account not found."
      );

    }


    const player =
      snapshot.docs[0].data();


    if (!player.email) {

      throw new Error(
        "This player account has no email."
      );

    }


    /*
      Login through Firebase Auth.
    */

    const result =
      await auth.signInWithEmailAndPassword(
        player.email,
        password
      );


    return loadPlayerFromAuthUser(
      result.user
    );

  }


  /* =======================================================
     LOAD PLAYER FROM AUTH USER
  ======================================================= */

  async function loadPlayerFromAuthUser(user) {

    if (!user) {

      return null;

    }


    try {

      const ref =
        db
          .collection("players")
          .doc(user.uid);


      const snapshot =
        await ref.get();


      if (!snapshot.exists) {

        throw new Error(
          "Your Firebase account has no PlayerDB profile."
        );

      }


      const player = {

        id:
          snapshot.id,

        ...snapshot.data()

      };


      /*
        Update last login.

        This is intentionally done here for normal
        login/current-player loading.
      */

      try {

        await ref.set(

          {

            lastLogin:
              firebase.firestore.FieldValue
                .serverTimestamp()

          },

          {

            merge:
              true

          }

        );

      } catch (loginUpdateError) {

        /*
          Do not prevent the player from loading
          if only the lastLogin update fails.
        */

        console.warn(
          "[PlayerDB] Could not update lastLogin:",
          loginUpdateError
        );

      }


      return player;

    } catch (error) {

      console.error(
        "[PlayerDB] loadPlayerFromAuthUser failed:",
        error
      );

      throw error;

    }

  }


  /* =======================================================
     CURRENT PLAYER
  ======================================================= */

  async function getCurrentPlayer() {

    const user =
      auth.currentUser;


    if (!user) {

      return null;

    }


    return loadPlayerFromAuthUser(
      user
    );

  }


  /* =======================================================
     FIND PLAYER BY USERNAME
  ======================================================= */

  async function getPlayer(username) {

    username =
      cleanUsername(username);


    if (!username) {

      return null;

    }


    const snapshot =
      await db
        .collection("players")
        .where(
          "usernameLower",
          "==",
          usernameKey(username)
        )
        .limit(1)
        .get();


    if (snapshot.empty) {

      return null;

    }


    return {

      id:
        snapshot.docs[0].id,

      ...snapshot.docs[0].data()

    };

  }


  /* =======================================================
     GET ALL PLAYERS
  ======================================================= */

  async function getPlayers() {

    const snapshot =
      await db
        .collection("players")
        .orderBy("usernameLower")
        .get();


    return snapshot.docs.map(
      function (doc) {

        return {

          id:
            doc.id,

          ...doc.data()

        };

      }
    );

  }


  /* =======================================================
     SEND INVITATION
  ======================================================= */

  async function sendInvitation(
    fromUsername,
    toUsername
  ) {

    const currentUser =
      auth.currentUser;


    if (!currentUser) {

      throw new Error(
        "You are not logged in."
      );

    }


    fromUsername =
      cleanUsername(fromUsername);

    toUsername =
      cleanUsername(toUsername);


    if (!fromUsername || !toUsername) {

      throw new Error(
        "Invalid player."
      );

    }


    if (
      usernameKey(fromUsername) ===
      usernameKey(toUsername)
    ) {

      throw new Error(
        "You cannot invite yourself."
      );

    }


    /*
      Verify sender.
    */

    const sender =
      await getPlayer(fromUsername);


    if (!sender) {

      throw new Error(
        "Your player account was not found."
      );

    }


    /*
      Verify that the logged-in Firebase account
      actually owns the sender profile.
    */

    if (
      sender.uid !==
      currentUser.uid
    ) {

      throw new Error(
        "You are not authorized to send invitations for this player."
      );

    }


    /*
      Verify target.
    */

    const target =
      await getPlayer(toUsername);


    if (!target) {

      throw new Error(
        "That player is not in the database."
      );

    }


    /*
      Create invitation.
    */

    const invitation = {

      fromUid:
        currentUser.uid,

      fromUsername:
        sender.username,

      toUid:
        target.uid,

      toUsername:
        target.username,

      status:
        "pending",

      createdAt:
        firebase.firestore.FieldValue
          .serverTimestamp()

    };


    const ref =
      await db
        .collection("invitations")
        .add(
          invitation
        );


    return {

      id:
        ref.id,

      ...invitation

    };

  }


  /* =======================================================
     GET RECEIVED INVITATIONS
  ======================================================= */

  async function getInvitations() {

    const user =
      auth.currentUser;


    if (!user) {

      return [];

    }


    const snapshot =
      await db
        .collection("invitations")
        .where(
          "toUid",
          "==",
          user.uid
        )
        .where(
          "status",
          "==",
          "pending"
        )
        .get();


    return snapshot.docs.map(
      function (doc) {

        return {

          id:
            doc.id,

          ...doc.data()

        };

      }
    );

  }


  /* =======================================================
     ACCEPT INVITATION
  ======================================================= */

  async function acceptInvitation(
    invitationId
  ) {

    const user =
      auth.currentUser;


    if (!user) {

      throw new Error(
        "You are not logged in."
      );

    }


    if (!invitationId) {

      throw new Error(
        "Invitation ID is required."
      );

    }


    const ref =
      db
        .collection("invitations")
        .doc(invitationId);


    const snapshot =
      await ref.get();


    if (!snapshot.exists) {

      throw new Error(
        "Invitation not found."
      );

    }


    const invitation =
      snapshot.data();


    /*
      Make sure this invitation belongs
      to the logged-in player.
    */

    if (
      invitation.toUid !==
      user.uid
    ) {

      throw new Error(
        "You are not authorized to accept this invitation."
      );

    }


    if (
      invitation.status !==
      "pending"
    ) {

      throw new Error(
        "This invitation is no longer pending."
      );

    }


    await ref.update({

      status:
        "accepted",

      acceptedAt:
        firebase.firestore.FieldValue
          .serverTimestamp()

    });


    return true;

  }


  /* =======================================================
     DECLINE INVITATION
  ======================================================= */

  async function declineInvitation(
    invitationId
  ) {

    const user =
      auth.currentUser;


    if (!user) {

      throw new Error(
        "You are not logged in."
      );

    }


    if (!invitationId) {

      throw new Error(
        "Invitation ID is required."
      );

    }


    const ref =
      db
        .collection("invitations")
        .doc(invitationId);


    const snapshot =
      await ref.get();


    if (!snapshot.exists) {

      throw new Error(
        "Invitation not found."
      );

    }


    const invitation =
      snapshot.data();


    /*
      Make sure this invitation belongs
      to the logged-in player.
    */

    if (
      invitation.toUid !==
      user.uid
    ) {

      throw new Error(
        "You are not authorized to decline this invitation."
      );

    }


    if (
      invitation.status !==
      "pending"
    ) {

      throw new Error(
        "This invitation is no longer pending."
      );

    }


    await ref.update({

      status:
        "declined",

      declinedAt:
        firebase.firestore.FieldValue
          .serverTimestamp()

    });


    return true;

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
     WATCH PLAYER
  ======================================================= */

  function watchPlayer(callback) {

    if (
      typeof callback !==
      "function"
    ) {

      throw new Error(
        "watchPlayer requires a callback function."
      );

    }


    console.log(
      "[PlayerDB] Starting player watcher..."
    );


    return auth.onAuthStateChanged(
      async function (user) {

        console.log(
          "[PlayerDB] Auth state changed:",
          user
        );


        /*
          User logged out.
        */

        if (!user) {

          console.log(
            "[PlayerDB] No authenticated user."
          );

          callback(null);

          return;

        }


        /*
          User is authenticated.
        */

        try {

          const ref =
            db
              .collection("players")
              .doc(user.uid);


          /*
            Load PlayerDB document.
          */

          const snapshot =
            await ref.get();


          /*
            Player document doesn't exist.
          */

          if (!snapshot.exists) {

            console.error(
              "[PlayerDB] Player document does not exist for UID:",
              user.uid
            );


            callback(null);

            return;

          }


          /*
            Build player object.
          */

          const player = {

            id:
              snapshot.id,

            ...snapshot.data()

          };


          console.log(
            "[PlayerDB] Player loaded:",
            player
          );


          /*
            Send player to your website.
          */

          callback(player);

        } catch (error) {

          console.error(
            "[PlayerDB] watchPlayer error:",
            error
          );


          /*
            Still notify the website.
          */

          callback(null);

        }

      }
    );

  }


  /* =======================================================
     UPDATE PLAYER
  ======================================================= */

  async function updatePlayer(updates) {

    const user =
      auth.currentUser;


    if (!user) {

      throw new Error(
        "You are not logged in."
      );

    }


    if (
      !updates ||
      typeof updates !== "object"
    ) {

      throw new Error(
        "Invalid player updates."
      );

    }


    const data = {

      ...updates,

      updatedAt:
        firebase.firestore.FieldValue
          .serverTimestamp()

    };


    /*
      Username update.
    */

    if (updates.username) {

      const username =
        cleanUsername(
          updates.username
        );


      validateUsername(
        username
      );


      const existing =
        await getPlayer(
          username
        );


      if (
        existing &&
        existing.uid !==
        user.uid
      ) {

        throw new Error(
          "That username is already taken."
        );

      }


      await user.updateProfile({

        displayName:
          username

      });


      data.username =
        username;


      data.usernameLower =
        usernameKey(username);

    }


    /*
      Never allow these fields to be
      changed through updatePlayer().
    */

    delete data.uid;
    delete data.email;
    delete data.createdAt;


    /*
      Save player.
    */

    await db
      .collection("players")
      .doc(user.uid)
      .set(
        data,
        {
          merge:
            true
        }
      );


    return getCurrentPlayer();

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.PlayerDB = {

    app:
      app,

    auth:
      auth,

    db:
      db,


    registerPlayer:
      registerPlayer,

    loginPlayer:
      loginPlayer,

    loginWithUsername:
      loginWithUsername,


    getCurrentPlayer:
      getCurrentPlayer,

    getCurrentUser:
      getCurrentUser,


    getPlayer:
      getPlayer,

    getPlayers:
      getPlayers,


    sendInvitation:
      sendInvitation,

    getInvitations:
      getInvitations,

    acceptInvitation:
      acceptInvitation,

    declineInvitation:
      declineInvitation,


    logoutPlayer:
      logoutPlayer,

    watchPlayer:
      watchPlayer,


    updatePlayer:
      updatePlayer

  };


  /* =======================================================
     READY
  ======================================================= */

  console.log(
    "[PlayerDB] Firebase PlayerDB initialized."
  );

})();

