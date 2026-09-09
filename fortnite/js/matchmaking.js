/* =========================================================
   VoidForge / BattleZone Matchmaking
   PlayerDB wrapper

   Requires:
   - Firebase compat SDK
   - playerdb.js

   Creates:
   window.BattleMatchmaking
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     CHECK PLAYERDB
  ======================================================= */

  if (!window.PlayerDB) {

    console.error(
      "[BattleMatchmaking] PlayerDB is not loaded."
    );

    return;
  }


  /* =======================================================
     GET REGISTERED PLAYERS
  ======================================================= */

  async function getRegisteredPlayers() {

    const currentUser =
      PlayerDB.getCurrentUser();


    if (!currentUser) {

      throw new Error(
        "You are not logged in."
      );

    }


    const players =
      await PlayerDB.getPlayers();


    /*
      Remove the current player from the list.
    */

    return players.filter(
      function (player) {

        return player.uid !==
          currentUser.uid;

      }
    );

  }


  /* =======================================================
     SEND INVITATION
  ======================================================= */

  async function sendInvitation(
    uid,
    username
  ) {

    const currentUser =
      PlayerDB.getCurrentUser();


    if (!currentUser) {

      throw new Error(
        "You are not logged in."
      );

    }


    if (!uid || !username) {

      throw new Error(
        "Invalid player."
      );

    }


    const currentPlayer =
      await PlayerDB.getCurrentPlayer();


    if (!currentPlayer) {

      throw new Error(
        "Your player profile could not be loaded."
      );

    }


    /*
      PlayerDB handles:
      - sender verification
      - target verification
      - self-invite prevention
      - invitation creation
    */

    return PlayerDB.sendInvitation(
      currentPlayer.username,
      username
    );

  }


  /* =======================================================
     ACCEPT INVITATION
  ======================================================= */

  async function acceptInvitation(
    invitationId
  ) {

    if (!invitationId) {

      throw new Error(
        "Invitation ID is required."
      );

    }


    return PlayerDB.acceptInvitation(
      invitationId
    );

  }


  /* =======================================================
     DECLINE INVITATION
  ======================================================= */

  async function declineInvitation(
    invitationId
  ) {

    if (!invitationId) {

      throw new Error(
        "Invitation ID is required."
      );

    }


    return PlayerDB.declineInvitation(
      invitationId
    );

  }


  /* =======================================================
     WATCH INVITATIONS
  ======================================================= */

  function watchInvitations(callback) {

    if (
      typeof callback !==
      "function"
    ) {

      throw new Error(
        "watchInvitations requires a callback."
      );

    }


    /*
      Firestore realtime listener.

      This is better than repeatedly polling
      getInvitations().
    */

    let unsubscribe = null;


    function startListener(user) {

      /*
        Remove previous listener.
      */

      if (unsubscribe) {

        unsubscribe();
        unsubscribe = null;

      }


      /*
        Logged out.
      */

      if (!user) {

        callback([]);

        return;

      }


      unsubscribe =
        PlayerDB.db
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
          .onSnapshot(

            function (snapshot) {

              const invitations =
                snapshot.docs.map(
                  function (doc) {

                    return {

                      id:
                        doc.id,

                      ...doc.data()

                    };

                  }
                );


              callback(
                invitations
              );

            },

            function (error) {

              console.error(
                "[BattleMatchmaking] Invitation listener error:",
                error
              );


              callback([]);

            }

          );

    }


    /*
      Listen for authentication changes.
    */

    const stopAuth =
      PlayerDB.auth.onAuthStateChanged(
        startListener
      );


    /*
      Return one cleanup function.
    */

    return function () {

      stopAuth();

      if (unsubscribe) {

        unsubscribe();

        unsubscribe = null;

      }

    };

  }


  /* =======================================================
     FIND MATCH
  ======================================================= */

  async function findMatch() {

    const user =
      PlayerDB.getCurrentUser();


    if (!user) {

      throw new Error(
        "You are not logged in."
      );

    }


    const player =
      await PlayerDB.getCurrentPlayer();


    if (!player) {

      throw new Error(
        "Your player profile could not be loaded."
      );

    }


    /*
      Basic matchmaking placeholder.

      For now this confirms that the player
      is authenticated and has a PlayerDB profile.

      A real queue/match system can be added here.
    */

    console.log(
      "[BattleMatchmaking] Searching for match:",
      player.username
    );


    return null;

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BattleMatchmaking = {

    getRegisteredPlayers:
      getRegisteredPlayers,

    sendInvitation:
      sendInvitation,

    acceptInvitation:
      acceptInvitation,

    declineInvitation:
      declineInvitation,

    watchInvitations:
      watchInvitations,

    findMatch:
      findMatch

  };


  console.log(
    "[BattleMatchmaking] Initialized."
  );


})();

