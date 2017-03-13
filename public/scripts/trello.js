var listsList = ""; // {BoardName : {list object}}

// HTML for new Shopify rule
var shopifyRule = "<li class='extraRule'><section class='columns eleven' style=margin-top:5px;'> <span class='column one'>Orders with</span>\
    <select class='optionSelect columns two' style='margin-left:0px; margin-right:5px;'>\
      <option>Country</option>\
      <option>Tag</option>\
      <option>Product Barcode</option>\
      <option>Product SKU</option>\
      <option>Product Name</option>\
    </select>\
    <input type='text' placeholder='Enter your value' class='columns three' style='margin-right:5px;' />\
    <span style='margin-right:10px;'>go to list</span>\
    <select class='listOption columns two' style='margin-left:0px;'>\
      <option>-</option>\
    </select>\
    <a class='columns one' href='#'><i class='icon-close'></i></a>\
  </section></li>";
// HTML for new Trello rule
var trelloRule = "<li class='extraRule'><section class='columns eleven'style=margin-top:5px;'><span class='column one'>Orders in </span>\
    <select class='listOption columns two' ></select>\
    <span class='column one'>list have</span>\
    <input type='text' class='column two' />\
    <span class='column two'>tag assigned to them.</span>\
    <a href='#' class='column one'><i class='icon-close'></i></a>\
  </section></li>";

var logout = function() {
    Trello.deauthorize();
    updateLoggedIn();
    window.location.reload(false);  //Reload the page
};

$("#disconnect").click(logout);  // Logout from Trello

// Log in to Trello
$("#connectLink").click(function() {
  try {
    Trello.authorize({
      type  : "popup",
      name  : "Shopify Orders",
      scope : {
        read    : 'allowRead',
        write   : 'allowWrite',
        account : 'allowAccount'
      },
      expiration: "never",
      persist : true,
      success : onAuthorize
    })
  } catch(e) {
    console.log(e);
  }
});

// Trello error message
var error = function(errorMsg) {
  console.log(errorMsg);
};

var getConfiguration = function() {
  // Get customers rules from the database
  $.ajax({
    type: "POST",
    url: "/get_configuration",
    data : {"shop" : "<%= shop %>" },
    success : function (data) {
        setInitialSettings(data);   // Set form based on customer rules
      }
    });
  };

  var setInitialSettings = function(data) {
    console.log(data)
    // Sets the initial config settings based on users saved settings.
    if (data.length === 0 ) {
      return ;  // No rules currently set
    } else {
        // Set recieved rule if exists
        if (data.recieved !== "null") {
          console.log(data.recieved);
          $('#recievedOrders option[id=' + data.recieved + ']').attr('selected','selected');

        };

        // Set fulfilled rule if exists
        if (data.fulfilled !== "null") {
          $('#fulfilledOrders option[id=' + data.fulfilled + ']').attr('selected','selected');
        };

        // Add shopify rules if they exist
        if (data.shopify_rules.length !== 0) {
          data.shopify_rules.forEach(function(rule) {
            addExtraShopifyRule();  // Add extra rule to rules div
            $("#extraShopifyRules li:last-child .optionSelect").val(rule.country);  // Set country/tag/barcode etc dropdown
            $("#extraShopifyRules li:last-child input").val(rule.input);  // Set input value
            $("#extraShopifyRules li:last-child .listOption option[id=" + rule.list + "]").attr('selected', 'selected');
          })
        };

        // Add trello rules if they exist
        if (data.trello_rules.length !== 0) {
          data.trello_rules.forEach(function(rule) {
            addExtraTrelloRule();
            $("#extraTrelloRules li:last-child .listOption option[id=" + rule.list + "]").attr('selected', 'selected');
            $("#extraTrelloRules li:last-child input").val(rule.input);
          });
      }
    }
  };

// Make sure Trello user is logged in. Get name, boards and lists.
// Called when the page is loaded and when the user logs in.
var onAuthorize = function() {
  // Send Trello token server to store in the session
  $.ajax({
    type: "POST",
    url: "/trello",
    data : {"trello_token" : localStorage.getItem(localStorage.key('trello_token'))}
  });

  updateLoggedIn(); // Update logged in message
  updateName();  // Get users name and update login details
  getBoards();
};

var updateName = function() {
  // Get Trello user's name
  Trello.members.get("me", function(member){
    $("#fullName").text("Logged in to Trello as: " + member.fullName + ".");
  });
};

var getBoards = function() {
  // Get users boards. For each board get the lists within that board
  Trello.get('/member/me/boards', function(res) {
    var numberOfBoards = res.length;  // total number of boards
    var boardCount = 0;  // Count of boards that have had their lists
    // For each board get lists from board and increment count
    for (board in res) {
      getLists(res[board], function() {
        boardCount ++;
        // Once all the lists have loaded get user's configuration
        if (boardCount == numberOfBoards) {
          getConfiguration();
        }
      })
    }
  }, function(err) {
    console.log(err);
  });
};

var getLists = function(board, callback) {
  var boardID = board['id'];
  var boardName = board['name'];
  Trello.get('/boards/'+boardID+'/lists', function(res) {
    // Append each list to the Option value of select element
    appendListToOption(res, boardID, boardName, function() {
      callback();
    });
  }, function(err) {
      console.log(err);
    });
  };

var appendListToOption = function(res, boardID, boardName, callback) {
  var listString = "";
  listString += "<optgroup label='"+boardName+"'>"
  for (var item in res) {
    var name = res[item]["name"];
    var id = res[item]["id"];
    listString += "<option value="+id+" id=" + id + ">" + name + "</option>"
  };
  listString += "</optgroup>";
  $('.listOption').append($(listString));
  listsList += listString;
  callback();
};


 var addExtraShopifyRule = function() {
  $("#extraShopifyRules").append($(shopifyRule));
  var lastRule = $("#extraShopifyRules li:last-child .listOption")
  $(lastRule).append($(listsList)); // Set to list of Trello Boards
  $("#extraShopifyRules a").click(function() {
    $(this).parent().remove();
  });
};

var addExtraTrelloRule = function() {
  $("#extraTrelloRules").append($(trelloRule));
  var lastRule = $("#extraTrelloRules li:last-child .listOption")
  $(lastRule).append($(listsList));

  // rule_count ++ ;
  // $("#extraTrelloRules li:last-child").attr("id", rule_count);
  $("#extraTrelloRules a").click(function() {
    $(this).parent().remove();
  });
};

var updateLoggedIn = function() {
    var isLoggedIn = Trello.authorized();
    $("#loggedout").toggle(!isLoggedIn);
    $("#loggedin").toggle(isLoggedIn);
};

// See if app has already been authorized
try {
  Trello.authorize({
    type  : "popup",
    name  : "Shopify Orders",
    scope : {
      read    : 'allowRead',
      write   : 'allowWrite',
      account : 'allowAccount'
    },
    expiration: "never",
    persist : true,
    success : onAuthorize
  })
} catch(e) {
  console.log(e);
};


updateLoggedIn(); // Check if user is logged in or not
