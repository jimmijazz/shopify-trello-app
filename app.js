const express = require('express');
const app = express();

var querystring= require('querystring');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var request = require('request');
var config = require('./settings');
var session = require('express-session');
var Trello = require("node-trello");
var OAuth = (require("oauth")).OAuth;
const mongodb = require("mongodb");
const ObjectID = mongodb.ObjectID;

var requestUrl = "https://trello.com/1/OAuthGetRequestToken";
var accessUrl = "https://trello.com/1/OAuthGetAccessToken";
var authorizeUrl = "https://trello.com/1/OAuthAuthorizeToken";


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({secret: 'keyboard cat'}));
app.use(express.static(path.join(__dirname, 'public')));

//Connect to database before starting the application Server
mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
  if (err) {
    console.log('Unable to connect to the database. Error:',err);
    process.exit(1);
  }
  // Save database object from the vallback for reuse
  db = database;
  console.log("database connection ready");
});

const SHOP = 'shop';  // MongoDB collection

var updateTrelloWebhooks = function(idModel) {
  // Check if Trello webhooks exist for the user. Add if false, update it true

};


// Shopify Authentication

// This function initializes the Shopify OAuth Process
// The template in views/embedded_app_redirect.ejs is rendered
app.get('/shopify_auth', function(req, res) {
    console.log(req);
    if (req.query.shop) {
        req.session.shop = req.query.shop;
        res.render('embedded_app_redirect', {
            shop: req.query.shop,
            api_key: config.oauth.api_key,
            scope: config.oauth.scope,
            redirect_uri: config.oauth.redirect_uri
        });
    }
});

// After the users clicks 'Install' on the Shopify website, they are redirected here
// Shopify provides the app the is authorization_code, which is exchanged for an access token
app.get('/access_token', function(req, res) {
    if (req.query.shop) {
        var params = {
            client_id: config.oauth.api_key,
            client_secret: config.oauth.client_secret,
            code: req.query.code
        }
        var req_body = querystring.stringify(params);
        request({
            url: 'https://' + req.query.shop + '/admin/oauth/access_token',
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(req_body)
            },
            body: req_body
        },
        function(err,resp,body) {
            body = JSON.parse(body);
            req.session.access_token = body.access_token;
            console.log(req.session);
            res.redirect('/');
        })
    }
});

// Renders the install/login form
app.get('/install', function(req, res) {
    res.render('app_install', {
        title: 'Shopify Embedded App'
    });
})

// Renders content for a modal
app.get('/modal_content', function(req, res) {
    res.render('modal_content', {
        title: 'Embedded App Modal'
    });
});

app.post('/trello', function(req, res) {
  // Creates new Trello object
  req.session.trello_token = req.body.trello_token;
  var t = new Trello(config.trello_key,req.session.trello_token);
  req.session.trello = t;
  res.sendStatus(200);

})

// The home page, checks if we have the access token, if not we are redirected to the install page
// This check should probably be done on every page, and should be handled by a middleware
app.get('/', function(req, res) {
    if (req.session.access_token) {

      // Render configuration setup page
      res.render('configuration', {
          title: 'Configuration',
          shop : req.session.shop,
          trello : false,
          api_key: config.oauth.api_key,
          shop: req.session.shop
      });
    } else {
      // App already installed
      if (req.query.shop) {
        req.session.shop = req.query.shop;
        res.render('embedded_app_redirect', {
            shop: req.query.shop,
            api_key: config.oauth.api_key,
            scope: config.oauth.scope,
            redirect_uri: config.oauth.redirect_uri
        });
      } else {
        res.sendStatus(400);
      }
    };
});

app.get('/add_product', function(req, res) {
    res.render('add_product', {
        title: 'Add A Product',
        api_key: config.oauth.api_key,
        shop: req.session.shop,
    });
})

app.get('/trello_data', function(req, res) {
  if (typeof req.session.trello === "undefined") {
    res.send("Trello not authorized");
  } else {
    t = req.session.trello;
    var t = new Trello(req.session.trello.key,req.session.trello.token);
    t.get("/1/members/me", function(err, data) {
      console.log(data);
    if (err) throw err;
    res.send(data);
  });
  }
})

app.get('/products', function(req, res) {
    var next, previous, page;
    page = req.query.page ? ~~req.query.page:1;

    next = page + 1;
    previous = page == 1 ? page : page - 1;

    request.get({
        url: 'https://' + req.session.shop + '.myshopify.com/admin/products.json?limit=5&page=' + page,
        headers: {
            'X-Shopify-Access-Token': req.session.access_token
        }
    }, function(error, response, body){
        if(error){
          return (error);
        };
        body = JSON.parse(body);
        res.render('products', {
            title: 'Products',
            api_key: config.oauth.api_key,
            shop: req.session.shop,
            next: next,
            previous: previous,
            products: body.products
        });
    })
});

app.post('/products', function(req, res) {
    data = {
     product: {
            title: req.body.title,
            body_html: req.body.body_html,
            images: [
                {
                    src: req.body.image_src
                }
            ],
            vendor: "Vendor",
            product_type: "Type"
        }
    }
    req_body = JSON.stringify(data);
    console.log(data);
    console.log(req_body);
    request({
        method: "POST",
        url: 'https://' + req.session.shop + '.myshopify.com/admin/products.json',
        headers: {
            'X-Shopify-Access-Token': req.session.access_token,
            'Content-type': 'application/json; charset=utf-8'
        },
        body: req_body
    }, function(error, response, body){
        if(error)
            return next(error);
        console.log(body);
        body = JSON.parse(body);
        if (body.errors) {
            return res.json(500);
        }
        res.json(201);
    })
})

function verifyRequest(req, res, next) {
    var map = JSON.parse(JSON.stringify(req.query));
    delete map['signature'];
    delete map['hmac'];

    var message = querystring.stringify(map);
    var generated_hash = crypto.createHmac('sha256', config.oauth.client_secret).update(message).digest('hex');
    console.log(generated_hash);
    console.log(req.query.hmac);
    if (generated_hash === req.query.hmac) {
        next();
    } else {
        return res.json(400);
    };
};

// SHOPIFY WEBHOOKS
app.post('/orders', function(req, res) {
  // Endpoint for recieving new orders
  console.log(req);
  res.sendStatus(200);
});

// TRELLO WEBHOOKS
app.get('/trello_webhook_confirm', function(req, res) {
  console.log(req.body);
  res.sendStatus(200);
});

// When an order is updated
app.post('/orders_updated', function(req, res) {
  console.log('use post');
  console.log(req.session.shop, req.body);
  res.sendStatus(200);
});


app.post('/trello_update', function(req, res) {
  console.log(req.body);
  res.sendStatus(200);
});

// When configuration is saved
app.post('/configuration', function(req, res) {

  var success = function(successMsg) {
    console.log(successMsg);
  };

  var error = function(errorMsg) {
    console.log(errorMsg);
  };

  t = req.session.trello;
  var t = new Trello(req.session.trello.key,req.session.trello.token);
  t.get("/1/members/me/tokens?webhooks=true", success, error);

  var createTrelloWebhook = function(parameters) {
    t.post('/webhooks', parameters, success, error)
  };
  // Get Trello webhooks

  // Check for existing Webhooks

  // Create Shopify Webhooks
  // const webhook_data = {
  //   "webhook": {
  //     "topic": "orders/create",
  //     "address": config.app_url + "/orders",
  //     "format": "json"
  //   },
  //   "webhook": {
  //     "topic": "orders/updated",
  //     "address": config.app_url + "orders_updated",
  //     "format": "json"
  //   }
  // };
  //
  // request({
  //   method: 'POST',
  //   url : "https://" + req.session.shop + "/admin/webhooks.json",
  //   headers: { "X-Shopify-Access-Token": req.session.access_token},
  //   json : webhook_data
  // }, function(err, response, body) {
  //     if (err) {
  //       console.log(err);
  //       console.log("Post response:", body)
  //     } else {
  //     console.log('Post response:', body)
  //   };
  // });

  try {
    var newShopifyRules = [];
    var newTrelloRules = [];
    var shopifyIndex = 0;
    var trelloIndex = 0;

    // For each rule sent add the rule as an object to appropriate list
    for (var item in req.body) {

      // New Shopify Rule (can be multiple Shopify rules)
      if (String(item).includes("country") && String(item).includes("shopify_rules")) {
        newShopifyRules.push({
          "_id"      : shopifyIndex,
          "country" : req.body["shopify_rules[" + shopifyIndex + "][country]"],
          "input"   : req.body["shopify_rules[" + shopifyIndex + "][input]"],
          "list"    : req.body["shopify_rules[" + shopifyIndex + "][list]"],
        });
        shopifyIndex ++;  // Increment unique ID for each rule

      // New Trello rule (can be multiple Trello rules)
      } else if (String(item).includes("list") && String(item).includes("trello_rules")) {
        newTrelloRules.push({
          "_id"      : trelloIndex,
          "list"    : req.body["trello_rules[" + trelloIndex + "][list]"],
          "input"   : req.body["trello_rules[" + trelloIndex + "][input]"],
        });
        trelloIndex ++;
      };
    };
  } catch (err) {
    console.log(err);
  };

  // Check if shop exists
  db.collection(SHOP).findOne({_id : req.body.shop }, function(err, result) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
    } else {
      if (result === null) {
        // Shop does not exist, insert new one
        db.collection(SHOP).insertOne({
          _id : req.body.shop,
          recieved : req.body.recieved,
          fulfilled : req.body.fulfilled,
          shopify_rules : newShopifyRules,
          trello_rules : newTrelloRules
        });
      } else {
        // Shop does exist, update rules
        db.collection(SHOP).update(
            {_id : req.body.shop},
            {recieved : req.body.recieved,
            fulfilled : req.body.fulfilled,
            shopify_rules : newShopifyRules,
            trello_rules : newTrelloRules
          });

      // Check if Trello webhooks exist. Update if different

      };
      // console.log(req.body);
      res.sendStatus(200);
    }
  });

});

// Returns the current settings for a shop
app.post('/get_configuration', function(req, res) {
  db.collection(SHOP).findOne({_id : req.body.shop }, function(err, result) {
    if (err) {
      console.log(err);
    } else {

      // Check if webhooks exist

      // Update if
      res.send(result);
    };
  })
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.listen((process.env.PORT || 3000));
console.log("Listening on port" + process.env.PORT);
