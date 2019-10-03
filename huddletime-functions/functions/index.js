const functions = require("firebase-functions");
const app = require("express")();
const auth = require("./utils/firebaseAuth");

const cors = require("cors");
app.use(cors());

const { db } = require("./utils/admin");

const {
  getAllIdeas,
  postOneIdea,
  getIdea,
  commentOnIdea,
  likeIdea,
  unlikeIdea,
  deleteIdea
} = require("./handlers/ideas");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require("./handlers/users");

// Idea routes
app.get("/ideas", getAllIdeas);
app.post("/idea", auth, postOneIdea);
app.get("/idea/:ideaId", getIdea);
app.delete("/idea/:ideaId", auth, deleteIdea);
app.get("/idea/:ideaId/like", auth, likeIdea);
app.get("/idea/:ideaId/unlike", auth, unlikeIdea);
app.post("/idea/:ideaId/comment", auth, commentOnIdea);

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", auth, uploadImage);
app.post("/user", auth, addUserDetails);
app.get("/user", auth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", auth, markNotificationsRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/ideas/${snapshot.data().ideaId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            ideaId: doc.id
          });
        }
      })
      .catch(err => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete(snapshot => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/ideas/${snapshot.data().ideaId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            ideaId: doc.id
          });
        }
      })
      .catch(err => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate(change => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("ideas")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then(data => {
          data.forEach(doc => {
            const idea = db.doc(`/ideas/${doc.id}`);
            batch.update(idea, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onIdeaDelete = functions.firestore
  .document("/ideas/{ideaId}")
  .onDelete((snapshot, context) => {
    const ideaId = context.params.ideaId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("ideaId", "==", ideaId)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection("likes")
          .where("ideaId", "==", ideaId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("ideaId", "==", ideaId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });
