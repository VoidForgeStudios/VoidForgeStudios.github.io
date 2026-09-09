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

  if (!window.PlayerDB) {
    console.error("[BattleMatchmaking] PlayerDB is not loaded.");
    throw new Error("BattleMatchmaking requires PlayerDB.");
  }

  async function getRegisteredPlayers() {
    const currentUser = PlayerDB.getCurrentUser();

    if (!currentUser) {
      throw new Error("You are not logged in.");
    }

    const players = await PlayerDB.getPlayers();

    return players.filter(function (player) {
      return player.uid !== currentUser.uid;
    });
  }

  async function sendInvitation(uid, username) {
    const currentUser = PlayerDB.getCurrentUser();

    if (!currentUser) {
      throw new Error("You are not logged in.");
    }

    if (!uid || !username) {
      throw new Error("Invalid player.");
    }

    const target = await PlayerDB.getPlayer(username);

    if (!target) {
      throw new Error("That player is no longer available.");
    }

    if (target.uid !== uid) {
      throw new Error(
        "Player information is out of date. Please refresh the page."
      );
    }

    if (target.uid === currentUser.uid) {
      throw new Error("You cannot invite yourself.");
    }

    const currentPlayer = await PlayerDB.getCurrentPlayer();

    if (!currentPlayer) {
      throw new Error("Your player profile could not be loaded.");
    }

    return PlayerDB.sendInvitation(
      currentPlayer.username,
      target.username
    );
  }

  async function acceptInvitation(invitationId) {
    if (!invitationId) {
      throw new Error("Invitation ID is required.");
    }

    return PlayerDB.acceptInvitation(invitationId);
  }

  async function declineInvitation(invitationId) {
    if (!invitationId) {
      throw new Error("Invitation ID is required.");
    }

    return PlayerDB.declineInvitation(invitationId);
  }

  function watchInvitations(callback) {
    if (typeof callback !== "function") {
      throw new Error("watchInvitations requires a callback.");
    }

    let unsubscribe = null;

    function startListener(user) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (!user) {
        callback([]);
        return;
      }

      unsubscribe = PlayerDB.db
        .collection("invitations")
        .where("toUid", "==", user.uid)
        .onSnapshot(
          function (snapshot) {
            const invitations = snapshot.docs
              .map(function (doc) {
                return {
                  id: doc.id,
                  ...doc.data()
                };
              })
              .filter(function (invitation) {
                return invitation.status === "pending";
              });

            callback(invitations);
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

    const stopAuth =
      PlayerDB.auth.onAuthStateChanged(startListener);

    return function () {
      stopAuth();

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }

  async function findMatch() {
    const user = PlayerDB.getCurrentUser();

    if (!user) {
      throw new Error("You are not logged in.");
    }

    const player = await PlayerDB.getCurrentPlayer();

    if (!player) {
      throw new Error("Your player profile could not be loaded.");
    }

    console.log(
      "[BattleMatchmaking] Searching for match:",
      player.username
    );

    return null;
  }

  window.BattleMatchmaking = {
    getRegisteredPlayers,
    sendInvitation,
    acceptInvitation,
    declineInvitation,
    watchInvitations,
    findMatch
  };

  console.log(
    "[BattleMatchmaking] Initialized:",
    window.BattleMatchmaking
  );
})();
