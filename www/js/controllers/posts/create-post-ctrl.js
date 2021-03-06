angular.module('app.controllers').controller('createPostCtrl',function ($scope, $stateParams, $document, posts, groups, profile, $rootScope, $controller) {
  $controller('abstractCreatePollCtrl', {$scope: $scope});
  $scope.prepareGroupPicker(false)

  $scope.placeholders = ['Words can move the masses. And yours can, too - if you get enough people to support your post. Be nice!',
                          'Write what you mean and mean what you write! But don\'t be mean!'];
  $scope.placeholder = '';
  
  $scope.profile = profile.get();

  $scope.data.post_text = '';

  $scope.$on('$ionicView.beforeEnter', function(){
    var indexPlaceholder = JSON.parse( window.localStorage.getItem('indexPlaceholder'));
    if (typeof indexPlaceholder === "undefined" || indexPlaceholder == null){
      indexPlaceholder = 0;
    }else{
      indexPlaceholder = parseInt(indexPlaceholder);
    }
    $scope.placeholder = $scope.placeholders[indexPlaceholder%2];
    indexPlaceholder++;
    window.localStorage.setItem( 'indexPlaceholder', JSON.stringify(indexPlaceholder));
  })

  $scope.validate = function(){
    if($scope.data.post_text.length == 0){
      $scope.validationAlert('Post message cannot be blank.')
      return false
    }     

    return true
  }

  $scope.send = function(postForm) {
    $scope.showSpinner();

    posts.create($scope.data.group.id, $scope.data.post_text).then(function(response){
      $scope.hideSpinner();
      $rootScope.showToast('Post successfully created!');
      $scope.updateActivityNewsfeed()
      $rootScope.path('/post/'+response.data.id);
    }).catch(function(response){
      $scope.hideSpinner();
      if (response.data && response.data.errors && response.data.errors.errors) {
          $scope.createContentAlert(response.data.errors.errors[0]);
        $scope.formClass = 'error';
      } else {
        $scope.createContentAlert('Error occurred');
      }       
    })
  }

  var $body = $document.find('body');
  $scope.$on('resize', function () {
    $scope.$digest();
  });

  $scope.height = function () {
    return $body.height() - 56 - 42;
  };

})