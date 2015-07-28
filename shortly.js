var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
// app.use(cookieParser());
app.use(session( {
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: true }
} ));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

// app.use(function(req, res, next) {
//   var sess = req.session;
// })
// app.use('/create', restrict);
app.use(express.static(__dirname + '/public'));

var sess;

function restrict(req, res, next) {
  // console.log("FROM Restrict", sess)
  if (sess) {
    next();

  } else {
    req.session.error = 'Access Denied!!';
    // console.log("rawr")
    res.redirect('/login');
  }
}

// var login = function(req, res, user) {
//   req.session.regenerate(function(){
//     req.session.user = user.get('username');
//     console.log('req.session', req.sessionID);
//     req.session.save();
//     console.log( "From Login Post", req.session.user);
//     res.redirect('/');
//   });
// }


app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login',
  function(req,res) {
    res.render('login'); 
  });

app.get('/signup',
  function(req,res) {
    res.render('signup'); 
  });

// var logout = function(req, res, next){
//   req.session.destroy();
//   res.redirect('/');
// };

// app.get('/logout', logout() );
app.get('/logout', function(req, res, next) {
  console.log(req.method, "REQ METHOD")
  console.log(req.session)
  
  req.session.destroy(function(){
    // if(err){
    //   console.log(err);
    // } else {
    //   console.log("Session DESTROYED", req.session);
      res.redirect('/login');
    }
  );
  // req.session = null;
  console.log("logged out in shortly")
  
});

app.post('/signup', 
  function(req, res){
    Users.query({where: {username: req.body.username}}).fetch().then(function(results){
      if(results.length > 0){
        console.log("username taken");
        res.redirect('/signup');
      } else {
        console.log("Creating new user");
        var user = new User({
          username: req.body.username, 
          password: req.body.password
        }).save().then(function(user){
          sess = req.session.regenerate(function(err){
            if(err){
              console.log(err);
            } else {
              sess.user = user.get('username');
              sess.save();
              res.redirect('/');
            }
          });
          // login(req, res, user);
        });
      }
    });
  });

app.post('/login', function(req, res) {
  var user = new User({
    username: req.body.username,
    password: req.body.password
  });
  Users.query({where: {
    username: user.get('username')
  }}).fetchOne().then(function(hashed) {
    console.log("Got Hashed", hashed.get('password'));
    bcrypt.compare(user.get('password'), hashed.get('password'), function(err, result) {
      console.log("Compared", result)
      if (result) {
        sess = req.session.regenerate(function(err){
          if(err) {
            console.log(err);
          } 
          else {
            sess.user = user.get('username');
            console.log('req.sessionID', req.sessionID);
            sess.save();
            // console.log( "req.session.user From Login Post", req.session.user);
            res.redirect('/');
            console.log('sess', sess);

          }
        });
      } 
      else {
        console.log("inside outer else");
        res.redirect('/login');
      }
    });
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
