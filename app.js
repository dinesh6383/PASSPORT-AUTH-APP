const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require("connect-flash");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(
  session({
    secret: "onceuponatimetherelivedaghost",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MY_MONGO_LINK);

const clientSchema = new mongoose.Schema({
  username: String,
  ogName: String,
  password: String,
  googleId: String,
  facebookId: String,
});

clientSchema.plugin(passportLocalMongoose);
const Client = mongoose.model("clients", clientSchema);

passport.use(Client.createStrategy());

passport.serializeUser(Client.serializeUser());
passport.deserializeUser(Client.deserializeUser());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/home",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    (accessToken, refreshToken, profile, done) => {
      Client.findOne({ googleId: profile.id }).then((currentUser) => {
        if (currentUser) {
          return done(null, currentUser);
        } else {
          new Client({
            username: profile.emails[0].value,
            ogName: profile.displayName,
            googleId: profile.id,
          })
            .save()
            .then((newUser) => {
              return done(null, newUser);
            });
        }
      });
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/home",
    },
    function (accessToken, refreshToken, profile, done) {
      console.log(profile);
      Client.findOne({ facebookId: profile.id }).then((currentUser) => {
        if (currentUser) {
          // console.log("fb User is" + currentUser);
          return done(null, currentUser);
        } else {
          new Client({
            username: profile.displayName,
            ogName: profile.displayName,
            facebookId: profile.id,
          })
            .save()
            .then((newUser) => {
              // console.log("new fb user is" + newUser);
              return done(null, newUser);
            });
        }
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("login", { errorMsg: req.flash("error") });
});

app.get("/home", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("home", { userDetails: req.user.ogName });
  } else {
    res.redirect("/");
  }
});

app.get("/register", (req, res) => {
  res.render("register", { errorMsg: req.flash("error") });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/home",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/home");
  }
);

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
  "/auth/facebook/home",
  passport.authenticate("facebook", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/home");
  }
);

app.post("/register", function (req, res) {
  Client.register(
    { username: req.body.username, ogName: req.body.fname },
    req.body.password,
    (err) => {
      if (err) {
        res.render("register", { errorMsg: err });
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/home");
        });
      }
    }
  );
});

app.post(
  "/",
  passport.authenticate("local", {
    failureRedirect: "/",
    failureFlash: true,
    failureMessage: "Invalid username or password",
  }),
  function (req, res) {
    res.redirect("/home");
  }
);

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});


app.listen(process.env.PORT || 3000, () => {
  console.log(`🌍 => PORT SUCCESSFULLY STARTED!`);
});
