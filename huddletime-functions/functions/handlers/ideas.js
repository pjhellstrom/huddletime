const { db } = require("../utils/admin");

exports.getAllIdeas = (req, res) => {
  db.collection("ideas")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let ideas = [];
      data.forEach(doc => {
        ideas.push({
          ideaId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(ideas);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneIdea = (req, res) => {
  if (req.body.body === "") {
    return res.status(400).json({ body: "Body can't be empty" });
  }

  const newIdea = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };

  db.collection("ideas")
    .add(newIdea)
    .then(doc => {
      const resIdea = newIdea;
      resIdea.ideaId = doc.id;
      res.json(resIdea);
    })
    .catch(err => {
      res.status(500).json({ error: "Something went wrong..." });
      console.error(err);
    });
};

// Get one idea
exports.getIdea = (req, res) => {
  let ideas = {};
  db.doc(`/ideas/${req.params.ideaId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Idea not found" });
      }
      ideas = doc.data();
      ideas.ideaId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("ideaId", "==", req.params.ideaId)
        .get();
    })
    .then(data => {
      ideas.comments = [];
      data.forEach(doc => {
        ideas.comments.push(doc.data());
      });
      return res.json(ideas);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Comment on an idea
exports.commentOnIdea = (req, res) => {
  if (req.body.body === "")
    return res.status(400).json({ comment: "Body can't be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    ideaId: req.params.ideaId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  console.log(newComment);

  db.doc(`/ideas/${req.params.ideaId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Idea not found..." });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong..." });
    });
};
// Like an idea
exports.likeIdea = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("ideaId", "==", req.params.ideaId)
    .limit(1);

  const ideaDocument = db.doc(`/ideas/${req.params.ideaId}`);

  let ideas;

  ideaDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        ideas = doc.data();
        ideas.ideaId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Idea not found..." });
      }
    })
    .then(data => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            ideaId: req.params.ideaId,
            userHandle: req.user.handle
          })
          .then(() => {
            ideas.likeCount++;
            return ideaDocument.update({ likeCount: ideas.likeCount });
          })
          .then(() => {
            return res.json(ideas);
          });
      } else {
        return res.status(400).json({ error: "Idea already liked" });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Unlike an idea
exports.unlikeIdea = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("ideaId", "==", req.params.ideaId)
    .limit(1);

  const ideaDocument = db.doc(`/ideas/${req.params.ideaId}`);

  let ideas;

  ideaDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        ideas = doc.data();
        ideas.ideaId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Idea not found..." });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: "Idea not liked..." });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            ideas.likeCount--;
            return ideaDocument.update({ likeCount: ideas.likeCount });
          })
          .then(() => {
            res.json(ideas);
          });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Delete an idea
exports.deleteIdea = (req, res) => {
  const document = db.doc(`/ideas/${req.params.ideaId}`);
  document
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Idea not found..." });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Idea deleted successfully" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
