//
// var authenticationSuccess = function() { console.log('Successful authentication'); };
// var authenticationFailure = function() { console.log('Failed authentication'); };
//
// var logout = function() {
//   Trello.deauthorize();
//   console.log(Trello);
// }
// function authorizeTrello() {
//   Trello.authorize({
//     type: 'popup',
//     name: 'Getting Started Application',
//     scope: {
//       read: 'true',
//       write: 'true' },
//     expiration: 'never',
//     success: authenticationSuccess,
//     error: authenticationFailure
//   });
// }
//
function getBoards() {
  Trello.get('/member/me/boards', function(success, error) {
    if(err) {
      console.log(err);
    } else {
      console.log(success);
    }
  });
  console.log(Trello.cards);
}
