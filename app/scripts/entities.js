/* Module for dialogs and messages */
'use strict';

define([
    'jquery',
    'underscore',
    'backbone',
    'quickblox',
    'Helpers'
], function(
    $,
    _,
    Backbone,
    QB,
    Helpers
) {

    var entities = {
		Models: {},
		Views: {},
		Collections: {},
        Helpers: {},
        active: ''
	};

    /* Message Model */
    entities.Models.Message = Backbone.Model.extend({
        defaults: {
            id: '',
            body: '',
            type: '',
            dialog_id: '',
            date_sent: null,
            notification_type: null,
            delivered_ids: [],
            read_ids: [],
            read: null
        },

        initialize: function() {
            this.accumulateInDialogModel();
        },

        validate: function(attrs) {

        },

        // accumulate messages in dialogs
        accumulateInDialogModel: function() {
            var dialogId = this.get('dialog_id'),
                messageId = this.get('id'),
                senderId = this.get('sender_id'),
                readIds = this.get('read_ids'),
                dialog = entities.Collections.dialogs.get(dialogId),
                isOpen = dialog.get('opened'),
                unreadCount = dialog.get('unread_count'),
                unreadMessages = dialog.get('unread_messages'),
                myUserId = entities.app.models.User.contact.id,
                isActive = (dialogId === entities.active),
                isHidden = (isActive && !window.isQMAppActive),
                isFromOtherUser = (myUserId !== senderId),
                isUnreadMessage = (readIds.length < 2);

            // collect last messages for opened dialog's
            if (isOpen) {
                dialog.get('messages').push(this);
            }

            // save as uread if dialog isn't active
            if ((!isActive || isHidden) && isFromOtherUser) {
                unreadMessages.push({
                    userId: senderId,
                    dialogId: dialogId,
                    messageId: messageId
                });
                dialog.set('unread_count', ++unreadCount);
                console.info(unreadCount + ' unread messages:', unreadMessages);
            }

            if ((this.get('read') === 1) && isFromOtherUser) {
                QB.chat.sendReadStatus({
                    userId: senderId,
                    dialogId: dialogId,
                    messageId: messageId
                });
            }
        }
    });

    /* Message Models Collection */
    entities.Collections.Messages = Backbone.Collection.extend({
        model: entities.Models.Message,

        initialize: function() {
            this.listenTo(this, 'add', this.update);
        },

        // keep count for messages collection
        update: function() {
            if (this.length > 20) {
                this.shift();
            }
        }
    });


    /* Dialog Model */
    entities.Models.Dialog = Backbone.Model.extend({
        defaults: {
            id: '',
            type: null,
            room_jid: null,
            room_name: null,
            room_photo: '',
            occupants_ids: null,
            room_updated_date: null,
            last_message_date_sent: null,
            last_message: '',
            last_messages: [],
            unread_messages: [],
            unread_count: '',
            messages: [],
            opened: false
        },

        // add dialog to collection after initialize
        initialize: function() {
            entities.Collections.dialogs.push(this);
        },

        validate: function(attrs) {

        }
    });

    /* Dialog Models Collection */
    entities.Collections.Dialogs = Backbone.Collection.extend({
        model: entities.Models.Dialog,

        sendReadStatus: function(id) {
            var dialog = this.get(id),
                unreadMeassages = dialog.get('unread_messages');

            // send read status for online messages wich was accumuladed as unread messages for dialog
            if (unreadMeassages.length > 0) {
                _.each(unreadMeassages, function(params) {
                    QB.chat.sendReadStatus(params);
                });

                dialog.set({
                    'unread_count': '',
                    'unread_messages': []
                });
            }

            // read all dialog's messages on REST
            QB.chat.message.update(null, {
                chat_dialog_id: id,
                read: 1
            }, function() {});
        }
    });

    // init dialog's collection with starting app
    entities.Collections.dialogs = new entities.Collections.Dialogs();


	// do something after selected dialog
	$('.list_contextmenu').on('click', 'li.dialog-item', function() {
        // set up this dialog_id as active
		entities.active = $(this).data('dialog');

		var dialogId = entities.active,
            dialogs = entities.Collections.dialogs,
            actived = dialogs.get(dialogId);

        // set as opened after took history from REST
        actived.set('opened', true);
        // send read status
        dialogs.sendReadStatus(dialogId);
	});

    // when app is getting focus
    $(window).focus(function() {
        if (entities.active) {
            var dialogs = entities.Collections.dialogs,
                dialog = dialogs.get(entities.active);

            // send read status
            dialogs.sendReadStatus(dialog.get('id'));
        }
    });

    return entities;
});
