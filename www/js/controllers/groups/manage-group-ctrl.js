angular.module('app.controllers').controller('manageGroupCtrl',function ($scope, groups, $stateParams, $ionicPopup, $ionicScrollDelegate, session, $location, $ionicActionSheet, $window, profile) {
  var groupID = parseInt($stateParams.id)
  $scope.data = {}
  $scope.group = {members: [], fieldsToFillOnJoin: [], sections: []} 
  $scope.groups = groups
  $scope.data.basic_settings = {}

  groups.loadAllDetails(groupID).then(function(){
    $scope.group = groups.get(groupID);

    var canManageGroup = $scope.group.currentUserIsManager() || $scope.group.currentUserIsOwner()
    if(!canManageGroup)
      $location.path('/group/'+$scope.group.id);
    else {
      $scope.data.basic_settings.official_name = $scope.group.official_name
      $scope.data.basic_settings.official_description = $scope.group.official_description
      $scope.data.basic_settings.acronym = $scope.group.acronym
      $scope.data.basic_settings.official_type = $scope.group.official_type
      $scope.data.basic_settings.official_address = $scope.group.official_address
      $scope.data.basic_settings.official_city = $scope.group.official_city
      $scope.data.basic_settings.official_state = $scope.group.official_state

      if($scope.group.currentUserIsOwner()){
        $scope.group.loadSubscriptionLevelInfo()
        $scope.group.loadBankAccount()
        $scope.group.loadPaymentCard()
      }

      if($scope.group.membership_control == 'public')
      $scope.data.membership_control = $scope.membershipControlOptions[0]
      else if($scope.group.membership_control == 'approval')
        $scope.data.membership_control = $scope.membershipControlOptions[1]
      else if($scope.group.membership_control == 'passcode')
        $scope.data.membership_control = $scope.membershipControlOptions[2]

      $scope.group.loadFieldsToFillOnJoin()

      groups.loadPermissions(groupID).then(function (permissionModel) {
        $scope.group.currentPermissions = permissionModel.get('required_permissions')
        $scope.group.currentPermissions.forEach(function(permissionID){
          $scope.data.selectedPermissions[permissionID] = true
        })
      })

      $scope.group.loadGroupMembers()

      $scope.group.loadUserContentSettings()
      $scope.data.invites_emails = ''

      $scope.group.loadSections()
    }
  })  

  var expandedSection = null
  $scope.toggleVisibility = function(sectionName){
    if(expandedSection == sectionName)
      expandedSection = null
    else
    expandedSection = sectionName
  }

  $scope.isExpanded = function(sectionName){
    return expandedSection == sectionName
  }

  $scope.validationAlert = function(msg){
   $ionicPopup.alert({
     cssClass: 'popup-by-ionic',
     title: 'Validation warning',
     template: msg
   });
  }

  $scope.showSaveAlert = function(msg){
   $ionicPopup.alert({
     cssClass: 'popup-by-ionic',
     title: 'Action failed',
     template: msg
   });
  }

  //////////// Avatar Operation /////////////////////////////////////////
  $scope.actionAvatar = function() {
    $ionicActionSheet.show({
       buttons: [
         { text: '<b>Upload</b>' },
       { text: '<b>Remove</b>' }
       ],
       cancelText: 'Cancel',
       cancel: function() {
          // add cancel code..
       },
       buttonClicked: function(index) {
         if(index == 0) {
              if($window.navigator && $window.navigator.camera){
                $window.navigator.camera.getPicture(function (imageData) {
                  $scope.group.avatar_file_path = 'data:image/jpeg;base64,' + imageData;
                  $scope.group.avatar_src_prefix = 'data:image/jpeg;base64,';
                  $scope.$apply();
                  $scope.showSpinner()
                  $scope.group.updateAvatar(imageData).then(function() {
                      $scope.hideSpinner()
                  });
                }, function (err) {
                    console.log(err);
                }, {
                  targetWidth: 256,
                  targetHeight: 256,
                  encodingType: $window.navigator.camera.EncodingType.JPEG,
                  sourceType: $window.navigator.camera.PictureSourceType.PHOTOLIBRARY,
                  destinationType: $window.navigator.camera.DestinationType.DATA_URL,
                  allowEdit: true,
                  correctOrientation: true
                });
              } else {
                  alert('this feature is not supported in browser')
              }
         } else {
            $scope.showSpinner()
            $scope.group.removeAvatar().then(function (data) {
              $scope.hideSpinner()
            });
            $scope.group.isDefaultAvatar = true;
            $scope.group.avatar_file_path = "https://api-dev.powerli.ne/bundles/civixfront/img/default_group.png";
            setTimeout(function () {
              $scope.group.isDefaultAvatar = true;
              $scope.$apply();
            });
         }
         return true;
       }
     });
  };

  //////////// BASIC SETTINGS ///////////////////////////////////////////
  
    $scope.officialTypeOptions = ['Educational', 'Non-Profit (Not Campaign)', 
    'Non-Profit (Campaign)',  'Business', 'Cooperative/Union','Other'
    ]

  $scope.saveBasicSettings = function(){
    $scope.showSpinner()
    $scope.group.updateBasicSettings($scope.data.basic_settings).then(function(){
      $scope.hideSpinner()
      $scope.showToast('Group profile settings updated successfully.')
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error.data))
    })
  }

  //////////// SUBSCRIPTION LEVEL ///////////////////////////////////////

  $scope.isActiveSubscriptionLevel = function(levelName){
    return $scope.group.subscriptionLevel == levelName
  }

  $scope.isSubscriptionLevelCancellable = function(){
    return $scope.group.subscriptionLevelIsFree && !$scope.group.subscriptionLevelIsFree()
  }

  $scope.cancelSubscriptionLevel = function(){
    var currentPlanNameHuman = $scope.group.subscriptionLevel

    var msg = 'You subscription level will change to Free when you click OK.'
    var confirmPopup = $ionicPopup.confirm({
      title: 'Cancel <span class="capitalize">'+currentPlanNameHuman+'</span> subscription level',
      template: msg,
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.changeSubscriptionLevel(groups.subscriptionLevels.FREE).then(function(){
          $scope.hideSpinner()
          $scope.showToast('Subscription level successfully changed to Free.')
        }, function(error){
          $scope.hideSpinner()
          $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    });
  }

  $scope.changeSubscriptionLevel = function(planName){
    if($scope.isActiveSubscriptionLevel(planName))
      return false

    if(planName != $scope.groups.subscriptionLevels.FREE && !$scope.group.paymentCard){
      $scope.addPaymentCard(planName)
      return false
    }

    var currentPlanNameHuman = $scope.group.subscriptionLevel
    var newPlanNameHuman = planName

    var msg = 'Do you want to change subscription level from <span class="capitalize">'+currentPlanNameHuman+'</span> to <span class="capitalize">'+newPlanNameHuman+'</span> ?'
    var confirmPopup = $ionicPopup.confirm({
      title: 'Change subscription level',
      template: msg,
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.changeSubscriptionLevel(planName).then(function(){
          $scope.hideSpinner()
          $scope.showToast('Subscription level successfully changed to <span class="capitalize">'+newPlanNameHuman+'</span>.')
        }, function(error){
          $scope.hideSpinner()
          if(error.data && error.data.message && (error.data.message == "User doesn't have an account in stripe" || error.data.message == 'This customer has no attached payment source'))
            $scope.showSaveAlert('In order to upgrade subscription plan you must first add a payment card in Payment Setup section.')
          else
            $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    });
  }

  //////////// PAYMENT METHODS ////////////////////////////////////////////

  $scope.showAddBankAccountPopup = false;
  $scope.addBankAccount = function(){
    $scope.showAddBankAccountPopup = true;
    $scope.showSpinner();
    profile.load().then(loaded, loaded);

    function loaded() {
      $scope.hideSpinner();
      $scope.profile = profile.get();
      console.log($scope.profile);
    }
    $ionicScrollDelegate.scrollTo(0, 80, true);
  }

  $scope.bankAccountAdded = function(){
    $scope.group.loadBankAccount()
    $scope.showToast('Bank account successfully added.')
  }

  $scope.deleteBankAccount = function(){
    var account = $scope.group.bankAccount
    var confirmPopup = $ionicPopup.confirm({
      title: 'Remove Bank Account',
      template: 'Do you want to remove bank account?',
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.removeStripeAccount().then(function(){
          $scope.hideSpinner()
          $scope.showToast('Bank account successfully removed.')
        }, function(error){
          $scope.hideSpinner()
          $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    })
  }  

  $scope.showAddPaymentCardPopup = false;
  $scope.changeToThisPlanAfterCardAdded = null
  $scope.addPaymentCard = function(planName){
    if(planName)
      $scope.changeToThisPlanAfterCardAdded = planName
    else
      $scope.changeToThisPlanAfterCardAdded = null

    $scope.showAddPaymentCardPopup = true;
    $ionicScrollDelegate.scrollTo(0, 80, true);
  }

  $scope.paymentCardAdded = function(){
    $scope.showToast('Payment card successfully added.')
    $scope.group.loadPaymentCard().then(function(){
      if($scope.changeToThisPlanAfterCardAdded){
        $scope.changeSubscriptionLevel($scope.changeToThisPlanAfterCardAdded)
        $scope.changeToThisPlanAfterCardAdded = null
      }
    })
  }

  $scope.deletePaymentCard = function(){
    var card = $scope.group.paymentCard

    var msg = 'Do you want to remove '+card.brand+' card?'
    if(!$scope.group.subscriptionLevelIsFree())
      msg += ' Group subscription plan will change to Free plan.'
    
    var confirmPopup = $ionicPopup.confirm({
      title: 'Remove Payment Card',
      template: msg,
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.removePaymentCard().then(function(){
          $scope.group.loadPaymentCard()
          $scope.group.changeSubscriptionLevel(groups.subscriptionLevels.FREE).then(function(){
            $scope.hideSpinner()
            $scope.showToast('Card successfully removed.')
          })
        })
      }
    })
  }

  //////////// MEMBERSHIP CONTROL SETTINGS //////////////////////////////

  $scope.data.membership_control = {}
  $scope.data.membership_control_passcode = ''

  $scope.membershipControlSettingsAltered = function(){
    if(!$scope.group)
      return false

    var ch1 = $scope.group.membership_control != $scope.data.membership_control.value
    var passcode = $scope.data.membership_control_passcode
    var ch2 = passcode && passcode.length > 0
    return ch1 || ch2
  }

  $scope.saveMembershipControlSettings = function(){
    var mtype = $scope.data.membership_control.value
    var passcode =  $scope.data.membership_control_passcode

    if(mtype == 'passcode' && passcode.length == 0){
       $scope.validationAlert('Passcode cannot be blank.')
      return
    } 
    $scope.group.changeMembershipControl(mtype, passcode).then(function(){
      $scope.showToast('Group membership control altered successfully.')
      $scope.group.membership_control = mtype
    }, function(error){
      console.log(error)
      if(error.status == 400 && error.data && error.data.message)
        $scope.showSaveAlert(error.data.message)
      else
        $scope.showSaveAlert(JSON.stringify(error))
    })
  }

  $scope.membershipControlSetToPasscode = function(){
    return $scope.data.membership_control.value == 'passcode'
  }

  $scope.membershipControlOptions = [
    {name: 'Public (Open to all)', value: 'public'},
    {name: 'Approval (User is approved by group leader)', value: 'approval'},
    {name: 'Passcode (User must provide correct passcode to enter)', value: 'passcode'}]

  $scope.addFieldRequiredToFillOnJoin = function(){
    var addPopup = $ionicPopup.show({
      template: '<input type="questionText" ng-model="data.questionText" style="padding:5px;">',
      title: 'Add Field',
      cssClass: 'popup-by-ionic',
      subTitle: 'Please Enter Field Text (Question)',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-positive',
          onTap: function(e) {
            if (!$scope.data.questionText) 
              e.preventDefault();
            return(true)
          }
        }
      ]
    });

    addPopup.then(function(res) {
      if(!res)
        return

      $scope.showSpinner()
      $scope.group.addFieldRequiredOnJoin($scope.data.questionText).then(function(response){
        $scope.group.loadFieldsToFillOnJoin()
        $scope.hideSpinner()
        $scope.showToast('Question successfully added.')
        $scope.data.questionText = ''
      }, function(error){
        $scope.hideSpinner()
        $scope.showSaveAlert(JSON.stringify(error))
      })
    });
  }

  $scope.removeRequiredField = function(field){
    var confirmPopup = $ionicPopup.confirm({
      title: 'Remove question',
      template: 'Remove question "'+field.field_name+'"?',
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.removeFieldRequiredOnJoin(field.id).then(function(){
          $scope.group.loadFieldsToFillOnJoin()
          $scope.hideSpinner()
          $scope.showToast('Question removed successfully.')
        }, function(error){
          $scope.hideSpinner()
          $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    });
  }

  //////// GROUP PERMISSIONS /////////////////////////////////////////////

  $scope.allGroupPermissions = groups.permissionsLabels
  $scope.data.selectedPermissions = {}

  var activePermissions = function(){
    var activePermissionsIDs = []
    Object.keys($scope.data.selectedPermissions).forEach(function(k){
      if($scope.data.selectedPermissions[k])
        activePermissionsIDs.push(k)
    })
    return activePermissionsIDs
  }

  $scope.groupPermissionsAltered = function(){
    if($scope.group == null)
      return false

    var originalPermission = $scope.group.currentPermissions
    return JSON.stringify(originalPermission)!=JSON.stringify(activePermissions());
  }

  $scope.saveGroupPermissions = function(){
    $scope.showSpinner()
    var activePermissionsIDs = activePermissions()
    $scope.group.changeGroupPermissions(activePermissionsIDs).then(function(){
      $scope.hideSpinner()
      $scope.showToast('Group permissions altered successfully.')
      $scope.group.currentPermissions = activePermissionsIDs
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })
  }


  ////// GROUP MEMBERS ////////////////////////////////////////

  $scope.canBeDowngradedToNormalMember = function(member){
    var isManager = member.user_role == 'manager'
    var currentUserIsOwner = $scope.group.currentUserIsOwner()
    var membershipIsNotPending = !$scope.membershipIsPending(member)
    return isManager && currentUserIsOwner && membershipIsNotPending
  }
  $scope.canBecameManager = function(member){
    var isNormalMember = member.user_role == 'member'
    var membershipIsNotPending = !$scope.membershipIsPending(member)
    var currentUserIsOwner = $scope.group.currentUserIsOwner()
    return isNormalMember && membershipIsNotPending && currentUserIsOwner
  }

  $scope.canRemoveUser = function(member){
    var currentUserIsOwner = $scope.group.currentUserIsOwner()
    var isMember = member.user_role == 'member'
    var currentUserIsManager = $scope.group.currentUserIsManager()
    var isMe = member.id == session.user_id

    if(currentUserIsOwner) // owner can remove anyone
      return true
    else if ((currentUserIsManager && isMember) || (currentUserIsManager && isMe)) // manager can remove only regular member and himself
      return true
    else
      return false
  }

  $scope.currentUserIsOwner = function(){
    return $scope.group.currentUserIsOwner && $scope.group.currentUserIsOwner()
  }

  $scope.membershipIsPending = function(member){
    return member.join_status == 'pending'
  }

  $scope.approveMembership = function(member){
    $scope.showSpinner()
    $scope.group.approveMembership(member.id).then(function(){
      $scope.hideSpinner()
      $scope.showToast('User '+member.username+' membership approved.')
      $scope.group.loadGroupMembers()
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })      
  }

  $scope.makeManager = function(member){
    $scope.showSpinner()
    $scope.group.makeManager(member.id).then(function(){
      $scope.hideSpinner()
      $scope.showToast('User '+member.username+' is now manager.')
      $scope.group.loadGroupMembers()
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })    
  }


  $scope.makeNormalMember = function(member){
    $scope.showSpinner()
    $scope.group.makeNormalMember(member.id).then(function(){
      $scope.hideSpinner()
      $scope.showToast('User '+member.username+' is now regular member.')
      $scope.group.loadGroupMembers()
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })  
  }

  $scope.removeFromGroup = function(member){
    var msg = 'Do you want to remove user '+member.username+' from group?'
    var aboutToRemoveMyself = session.user_id == member.id
    if(aboutToRemoveMyself)
      msg = 'Do you want to leave this group?'
    
    var confirmPopup = $ionicPopup.confirm({
      title: 'Remove user',
      template: msg,
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.removeMember(member.id).then(function(){
          $scope.hideSpinner()
          if(aboutToRemoveMyself)
            $location.path('/group/'+$scope.group.id);
          $scope.showToast('User '+member.username+' removed successfully from group')
        }, function(error){
          $scope.hideSpinner()
          $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    });
  }

  ////// GROUP SECTIONS /////////////////////////////////////////

  $scope.addGroupSection = function(){
    $scope.data.newSectionName = ''
    var addSectionPopup = $ionicPopup.show({
      template: '<input type="text" ng-model="data.newSectionName">',
      title: 'Add Group Section',
      subTitle: 'Please enter section name',
      cssClass: 'popup-by-ionic',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-positive',
          onTap: function(e) {
            if (!$scope.data.newSectionName) 
              e.preventDefault();
          }
        }
      ]
    });

    addSectionPopup.then(function(res) {
      if($scope.data.newSectionName){
        var s = $scope.data.newSectionName
        $scope.showSpinner()
        $scope.group.addSection(s).then(function(){
          $scope.hideSpinner()
          $scope.showToast("Group section '"+s+"' added successfully.")
        })
      }

    });
  }

  $scope.deleteGroupSection = function(section){
    $scope.data.newSectionName = ''
    var deleteSectionPopup = $ionicPopup.show({
      title: 'Delete Group Section',
      subTitle: "Do you want to remove section '"+section.title+"'?",
      cssClass: 'popup-by-ionic',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Delete</b>',
          type: 'button-assertive',
          onTap: function(e) {
            return(true)
          }
        }
      ]
    });

    deleteSectionPopup.then(function(res) {
      if(res){
        $scope.showSpinner()
        $scope.group.deleteSection(section.id).then(function(){
          $scope.hideSpinner()
          $scope.showToast("Group section '"+section.title+"' removed successfully.")
        })
      }
    });
  }

  $scope.editSectionMembers = function(section){
    section.inEditMode = true
    section.editMembersHash = {}
    section.wasMemberBeforeChangesWereMade = {}
    section.members.forEach(function(m){
      section.editMembersHash[m.id] = true
      section.wasMemberBeforeChangesWereMade[m.id] = true
    })
  }

  $scope.saveSectionMembers = function(section){
    var userIDsToAdd = []
    var userIDsToRemove = []
    _.each(section.editMembersHash, function(addThisUser, userID){
      var removeThisUser = !addThisUser
      var wasMember = section.wasMemberBeforeChangesWereMade[userID] == true
      if(addThisUser && !wasMember)
        userIDsToAdd.push(userID)
      else if(removeThisUser && wasMember)
        userIDsToRemove.push(userID)
    })

    if(userIDsToAdd.length == 0 && userIDsToRemove == 0){
      $ionicPopup.alert({
        cssClass: 'popup-by-ionic',
        title: 'Edit Section Members',
        template: 'Nothing to save, no changes were made.'
      });

      return false
    }

    msg = ''
    if(userIDsToAdd.length > 0)
      msg += 'Add '+userIDsToAdd.length+' member(s) to this section? '
    if(userIDsToRemove.length > 0)
      msg += 'Remove '+userIDsToRemove.length+' member(s) from this section?'     

    var confirmPopup = $ionicPopup.confirm({
      title: 'Edit Section Members',
      template: msg,
      cssClass: 'popup-by-ionic',
    });

    confirmPopup.then(function(res) {
      if(res) {
        section.inEditMode = false
        $scope.showSpinner()
        $scope.group.changeSectionMembers(section.id,userIDsToAdd, userIDsToRemove).then(function(){
          $scope.hideSpinner()
          $scope.showToast("Members of section '"+section.title+"' updated successfully.")
        }, function(error){
          $scope.hideSpinner()
          $scope.showSaveAlert(JSON.stringify(error))
        })
      }
    });    
  }

  $scope.cancelEditSectionMembers = function(section){
    section.inEditMode = false
  }

  ////// USER CONTENT SETUP ///////////////////////////////////

  $scope.usingPaidSubscription = function(){
    return $scope.group.subscriptionLevelIsFree && !$scope.group.subscriptionLevelIsFree()
  }
  $scope.updateUserContentSettings = function(){
    if($scope.group.petition_per_month < 1 || 1000 < $scope.group.petition_per_month ){
      $scope.validationAlert('Limit of user petitions and posts must be between 1 and 1000')
      return false
    }  
    if($scope.group.petition_percent < 1 || 50 < $scope.group.petition_percent ){
      $scope.validationAlert('Quorum percentage must be between 1 and 50')
      return false
    }    
    if($scope.group.petition_duration < 1 || 30 < $scope.group.petition_duration){
      $scope.validationAlert('Quorum duration must be between 1 and 30')
      return false
    }    

    $scope.showSpinner()
    $scope.group.updateUserContentSettings().then(function(){
      $scope.hideSpinner()
      $scope.showToast('User content settings updated successfully.')
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })
  }

  ////// SEND INVITATIONS //////////////////////////////////////

  $scope.sendGroupInvites = function(){
    if($scope.data.invites_emails == null || $scope.data.invites_emails.length == 0)
      return
    
    var emailsAsArray = $scope.data.invites_emails.split(',')
    $scope.showSpinner()
    $scope.group.inviteUsers(emailsAsArray).then(function(){
      $scope.hideSpinner()
      var userCount = emailsAsArray.length
      $scope.showToast('Invitations send successfully to '+userCount+' user(s).')
      $scope.data.invites_emails = ''
    }, function(error){
      $scope.hideSpinner()
      $scope.showSaveAlert(JSON.stringify(error))
    })
  }

  ////// REPORTS /////////////////////////////////////////////////

  $scope.getPollResponsesReport = function(){
    var confirmPopup = $ionicPopup.confirm({
      title: 'Confirm',
      cssClass: 'popup-by-ionic publish-content',
      content: 'Do you want to download the detailed Membership Roster?',
      scope: $scope
    });

    confirmPopup.then(function(res) {
      if(res) {
        $scope.showSpinner()
        $scope.group.getPollResponsesReport().then(function() {
          $scope.hideSpinner()
        }, function (err){
          $scope.hideSpinner()
        });
      }
    });
  }
})