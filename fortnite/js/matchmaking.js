/* =========================================================
   BattleZone Matchmaking
   Firebase Auth + Firestore
   Classic browser script
========================================================= */

(function(){

  "use strict";


  const Matchmaking = {};


  /* =======================================================
     STATE
  ======================================================= */

  let player = null;

  let unsubscribeTicket = null;

  let searching = false;

  let currentMatchId = null;


  /* =======================================================
     FIREBASE
  ======================================================= */

  function getAuth(){

    if(!window.PlayerDB){

      throw new Error(
        "PlayerDB is not loaded."
      );
    }

    if(!PlayerDB.auth){

      throw new Error(
        "Firebase Auth is unavailable."
      );
    }

    return PlayerDB.auth;
  }


  function getDB(){

    if(!window.PlayerDB){

      throw new Error(
        "PlayerDB is not loaded."
      );
    }

    if(!PlayerDB.db){

      throw new Error(
        "Firestore is unavailable."
      );
    }

    return PlayerDB.db;
  }


  /* =======================================================
     PLAYER
  ======================================================= */

  Matchmaking.setPlayer =
    function(currentPlayer){

      player =
        currentPlayer || null;

    };


  async function loadPlayer(){

    if(player){
      return player;
    }


    if(
      window.PlayerDB &&
      typeof PlayerDB.getCurrentPlayer ===
      "function"
    ){

      player =
        await PlayerDB.getCurrentPlayer();

      return player;
    }


    throw new Error(
      "Could not load player."
    );
  }


  /* =======================================================
     START
  ======================================================= */

  Matchmaking.start =
    async function(){

      if(searching){

        return;

      }


      const auth =
        getAuth();

      const db =
        getDB();


      const user =
        auth.currentUser;


      if(!user){

        throw new Error(
          "You must be logged in."
        );
      }


      const currentPlayer =
        await loadPlayer();


      if(
        !currentPlayer ||
        !currentPlayer.uid
      ){

        throw new Error(
          "Player profile was not found."
        );
      }


      /*
        Verify that the player actually exists
        in the players collection.
      */

      const playerRef =
        db
          .collection("players")
          .doc(user.uid);


      const playerSnapshot =
        await playerRef.get();


      if(!playerSnapshot.exists){

        throw new Error(
          "Your player account is not in the database."
        );
      }


      /*
        Always use Firestore's actual player data.
      */

      player =
        playerSnapshot.data();


      searching = true;


      dispatch(
        "battlezone-matchmaking-started"
      );


      showOverlay();


      const ticketRef =
        db
          .collection("matchmaking")
          .doc(user.uid);


      /*
        Remove stale ticket / create new ticket.
      */

      await ticketRef.set({

        uid: user.uid,

        username:
          player.username ||
          user.displayName ||
          "PLAYER",

        usernameLower:
          String(
            player.username ||
            user.displayName ||
            "player"
          ).toLowerCase(),

        status: "waiting",

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()

      });


      /*
        Listen to our own ticket.

        Another player can create a match
        involving us.
      */

      subscribeToTicket(
        ticketRef
      );


      /*
        Search for an existing waiting player.
      */

      await findOpponent();

    };


  /* =======================================================
     SEARCH FOR OPPONENT
  ======================================================= */

  async function findOpponent(){

    if(!searching){
      return;
    }


    const db =
      getDB();

    const auth =
      getAuth();

    const uid =
      auth.currentUser.uid;


    /*
      Find waiting players.

      We deliberately use a small batch.
    */

    const snapshot =
      await db
        .collection("matchmaking")
        .where(
          "status",
          "==",
          "waiting"
        )
        .limit(10)
        .get();


    let opponent = null;


    snapshot.forEach(
      function(doc){

        if(
          !opponent &&
          doc.id !== uid
        ){

          opponent = {
            id: doc.id,
            data: doc.data()
          };

        }

      }
    );


    if(!opponent){

      setStatus(
        "Searching for an opponent..."
      );

      return;
    }


    /*
      Make sure opponent still exists
      as a real player.
    */

    const opponentPlayer =
      await db
        .collection("players")
        .doc(opponent.id)
        .get();


    if(!opponentPlayer.exists){

      return;

    }


    await createMatch(
      opponent.id,
      opponent.data
    );

  }


  /* =======================================================
     CREATE MATCH
  ======================================================= */

  async function createMatch(
    opponentUid,
    opponentTicket
  ){

    if(!searching){
      return;
    }


    const db =
      getDB();

    const auth =
      getAuth();

    const myUid =
      auth.currentUser.uid;


    if(
      !opponentUid ||
      opponentUid === myUid
    ){

      return;
    }


    /*
      Deterministic ID.

      Both players calculate exactly
      the same match ID.
    */

    const ids = [
      myUid,
      opponentUid
    ].sort();


    const matchId =
      ids[0] + "_" + ids[1];


    const matchRef =
      db
        .collection("matches")
        .doc(matchId);


    /*
      Transaction protects against two clients
      trying to create the same match.
    */

    await db.runTransaction(
      async function(transaction){

        const existing =
          await transaction.get(
            matchRef
          );


        if(existing.exists){

          return;

        }


        const opponentRef =
          db
            .collection("matchmaking")
            .doc(opponentUid);


        const myRef =
          db
            .collection("matchmaking")
            .doc(myUid);


        const opponentSnapshot =
          await transaction.get(
            opponentRef
          );


        const mySnapshot =
          await transaction.get(
            myRef
          );


        if(
          !opponentSnapshot.exists ||
          !mySnapshot.exists
        ){

          return;

        }


        const opponentData =
          opponentSnapshot.data();

        const myData =
          mySnapshot.data();


        if(
          opponentData.status !==
          "waiting"
        ){

          return;

        }


        if(
          myData.status !==
          "waiting"
        ){

          return;

        }


        /*
          Create match.
        */

        transaction.set(
          matchRef,
          {

            matchId: matchId,

            players: [
              myUid,
              opponentUid
            ],

            playerData: {

              [myUid]: {
                uid: myUid,
                username:
                  myData.username ||
                  "PLAYER"
              },

              [opponentUid]: {
                uid: opponentUid,
                username:
                  opponentData.username ||
                  "PLAYER"
              }

            },

            status:
              "starting",

            createdAt:
              firebase.firestore.FieldValue
                .serverTimestamp(),

            startedBy:
              myUid

          }
        );


        /*
          Mark OUR ticket matched.
        */

        transaction.update(
          myRef,
          {

            status:
              "matched",

            matchId:
              matchId,

            opponentUid:
              opponentUid,

            updatedAt:
              firebase.firestore.FieldValue
                .serverTimestamp()

          }
        );

      }
    );


    currentMatchId =
      matchId;


    /*
      Listen for match document.
    */

    subscribeToMatch(
      matchRef
    );

  }


  /* =======================================================
     TICKET LISTENER
  ======================================================= */

  function subscribeToTicket(
    ticketRef
  ){

    if(unsubscribeTicket){

      unsubscribeTicket();

    }


    unsubscribeTicket =
      ticketRef.onSnapshot(
        async function(snapshot){

          if(!snapshot.exists){

            return;
          }


          const data =
            snapshot.data();


          if(
            data.status ===
            "matched" &&
            data.matchId
          ){

            currentMatchId =
              data.matchId;


            const matchRef =
              getDB()
                .collection("matches")
                .doc(
                  data.matchId
                );


            subscribeToMatch(
              matchRef
            );

          }

        },
        function(error){

          console.error(
            "[Matchmaking] Ticket listener:",
            error
          );

        }
      );

  }


  /* =======================================================
     MATCH LISTENER
  ======================================================= */

  function subscribeToMatch(
    matchRef
  ){

    matchRef.onSnapshot(
      async function(snapshot){

        if(!snapshot.exists){

          return;
        }


        const match =
          snapshot.data();


        if(
          !match.players ||
          !Array.isArray(match.players)
        ){

          return;
        }


        const auth =
          getAuth();

        const uid =
          auth.currentUser &&
          auth.currentUser.uid;


        if(
          !uid ||
          !match.players.includes(uid)
        ){

          return;
        }


        const opponentUid =
          match.players.find(
            function(id){
              return id !== uid;
            }
          );


        let opponent =
          match.playerData &&
          match.playerData[
            opponentUid
          ];


        /*
          If playerData is missing,
          load the real Firestore player.
        */

        if(!opponent){

          const opponentSnapshot =
            await getDB()
              .collection("players")
              .doc(opponentUid)
              .get();


          if(
            opponentSnapshot.exists
          ){

            const data =
              opponentSnapshot.data();

            opponent = {

              uid:
                opponentUid,

              username:
                data.username ||
                "PLAYER"

            };

          }

        }


        showMatchFound(
          player,
          opponent
        );


        /*
          Give the UI a moment to display
          MATCH FOUND before redirect.
        */

        setTimeout(
          function(){

            window.location.href =
              "./game.html?match=" +
              encodeURIComponent(
                match.matchId
              );

          },
          1800
        );

      },
      function(error){

        console.error(
          "[Matchmaking] Match listener:",
          error
        );

        showError(
          error.message ||
          "Matchmaking error."
        );

        reset();

      }
    );

  }


  /* =======================================================
     CANCEL
  ======================================================= */

  Matchmaking.cancel =
    async function(){

      if(!searching){

        hideOverlay();

        return;

      }


      searching = false;


      const auth =
        getAuth();

      const db =
        getDB();


      if(
        unsubscribeTicket
      ){

        unsubscribeTicket();

        unsubscribeTicket =
          null;

      }


      if(
        auth.currentUser
      ){

        const ticketRef =
          db
            .collection("matchmaking")
            .doc(
              auth.currentUser.uid
            );


        try{

          await ticketRef.delete();

        }catch(error){

          /*
            It is okay if the ticket was already
            changed by the matchmaking process.
          */

          console.warn(
            "[Matchmaking] Ticket cleanup:",
            error
          );

        }

      }


      currentMatchId =
        null;


      hideOverlay();


      dispatch(
        "battlezone-matchmaking-cancelled"
      );

    };


  /* =======================================================
     RESET
  ======================================================= */

  function reset(){

    searching = false;

    currentMatchId =
      null;

    if(unsubscribeTicket){

      unsubscribeTicket();

      unsubscribeTicket =
        null;

    }

    hideOverlay();

    dispatch(
      "battlezone-matchmaking-cancelled"
    );

  }


  /* =======================================================
     UI
  ======================================================= */

  function showOverlay(){

    const overlay =
      document.getElementById(
        "matchmakingOverlay"
      );

    if(overlay){

      overlay.classList.add(
        "visible"
      );

    }


    const searchingContent =
      document.querySelector(
        ".searching-content"
      );

    const found =
      document.querySelector(
        ".match-found"
      );


    if(searchingContent){

      searchingContent.classList.remove(
        "hidden"
      );

    }


    if(found){

      found.classList.remove(
        "visible"
      );

    }


    setStatus(
      "Searching for an opponent..."
    );


    const cancel =
      document.getElementById(
        "cancelButton"
      );


    if(cancel){

      cancel.onclick =
        function(){

          Matchmaking.cancel();

        };

    }

  }


  function hideOverlay(){

    const overlay =
      document.getElementById(
        "matchmakingOverlay"
      );

    if(overlay){

      overlay.classList.remove(
        "visible"
      );

    }

  }


  function setStatus(
    text
  ){

    const status =
      document.getElementById(
        "matchStatus"
      );

    if(status){

      status.textContent =
        text;

    }

  }


  function showMatchFound(
    me,
    opponent
  ){

    const searchingContent =
      document.querySelector(
        ".searching-content"
      );

    const found =
      document.querySelector(
        ".match-found"
      );


    if(searchingContent){

      searchingContent.classList.add(
        "hidden"
      );

    }


    if(found){

      found.classList.add(
        "visible"
      );

    }


    const myName =
      document.getElementById(
        "myMatchName"
      );

    const enemyName =
      document.getElementById(
        "enemyMatchName"
      );

    const myAvatar =
      document.getElementById(
        "myMatchAvatar"
      );

    const enemyAvatar =
      document.getElementById(
        "enemyMatchAvatar"
      );


    const myUsername =
      me?.username ||
      "PLAYER";


    const enemyUsername =
      opponent?.username ||
      "PLAYER";


    if(myName){

      myName.textContent =
        myUsername;

    }


    if(enemyName){

      enemyName.textContent =
        enemyUsername;

    }


    if(myAvatar){

      myAvatar.textContent =
        initials(
          myUsername
        );

    }


    if(enemyAvatar){

      enemyAvatar.textContent =
        initials(
          enemyUsername
        );

    }

  }


  function initials(
    name
  ){

    return String(
      name || "?"
    )
      .trim()
      .substring(0,2)
      .toUpperCase();

  }


  function showError(
    message
  ){

    const box =
      document.getElementById(
        "errorBox"
      );


    if(!box){
      return;
    }


    box.textContent =
      message;


    box.classList.add(
      "visible"
    );


    setTimeout(
      function(){

        box.classList.remove(
          "visible"
        );

      },
      5000
    );

  }


  /* =======================================================
     EVENT
  ======================================================= */

  function dispatch(
    name
  ){

    window.dispatchEvent(
      new CustomEvent(name)
    );

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  Matchmaking.isSearching =
    function(){

      return searching;

    };


  Matchmaking.getMatchId =
    function(){

      return currentMatchId;

    };


  window.Matchmaking =
    Matchmaking;


  console.log(
    "[BattleZone] Matchmaking initialized."
  );


})();
