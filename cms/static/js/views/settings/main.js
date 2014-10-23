define(["js/views/validation", "codemirror", "underscore", "jquery", "jquery.ui", "js/utils/date_utils", "js/models/uploads",
    "js/views/uploads", "js/utils/change_on_enter", "jquery.timepicker", "date"],
    function(ValidatingView, CodeMirror, _, $, ui, DateUtils, FileUploadModel, FileUploadDialog, TriggerChangeEventOnEnter) {

var DetailsView = ValidatingView.extend({
    // Model class is CMS.Models.Settings.CourseDetails
    events : {
        "input input" : "updateModel",
        "input textarea" : "updateModel",
        // Leaving change in as fallback for older browsers
        "change input" : "updateModel",
        "change textarea" : "updateModel",
        'click .remove-course-introduction-video' : "removeVideo",
        'focus #course-overview' : "codeMirrorize",
        'click #enable-enrollment-email' : "toggleEnrollmentEmails",
        'focus #pre-enrollment-email' : "codeMirrorize",
        'focus #post-enrollment-email' : "codeMirrorize",
        'click #test_email_pre': "sendTestEmail",
        'click #test_email_post': "sendTestEmail",
        'click #fill_default_email_pre': "showDefaultTemplate",
        'click #fill_default_email_post': "showDefaultTemplate",
        'mouseover .timezone' : "updateTime",
        // would love to move to a general superclass, but event hashes don't inherit in backbone :-(
        'focus :input' : "inputFocus",
        'blur :input' : "inputUnfocus",
        'click .action-upload-image': "uploadImage",
    },

    initialize : function() {
        this.fileAnchorTemplate = _.template('<a href="<%= fullpath %>"> <i class="icon-file"></i><%= filename %></a>');
        // fill in fields
        this.$el.find("#course-organization").val(this.model.get('org'));
        this.$el.find("#course-number").val(this.model.get('course_id'));
        this.$el.find("#course-name").val(this.model.get('run'));
        this.$el.find('.set-date').datepicker({ 'dateFormat': 'm/d/yy' });

        // Avoid showing broken image on mistyped/nonexistent image
        this.$el.find('img.course-image').error(function() {
            $(this).hide();
        });
        this.$el.find('img.course-image').load(function() {
            $(this).show();
        });

        this.listenTo(this.model, 'invalid', this.handleValidationError);
        this.listenTo(this.model, 'change', this.showNotificationBar);
        this.selectorToField = _.invert(this.fieldToSelectorMap);

        /* Memoize html elements for enrollment emails */
        this.enrollment_email_settings = this.$el.find('#enrollment-email-settings');

        this.pre_enrollment_email_elem = this.$el.find('#' + this.fieldToSelectorMap['pre_enrollment_email']);
        this.pre_enrollment_email_subject_elem = this.$el.find('#' + this.fieldToSelectorMap['pre_enrollment_email_subject']);
        this.pre_enrollment_email_field = this.$el.find('#field-pre-enrollment-email');
        this.pre_enrollment_email_subject_field = this.$el.find('#field-pre-enrollment-email-subject');

        this.post_enrollment_email_elem = this.$el.find('#' + this.fieldToSelectorMap['post_enrollment_email']);
        this.post_enrollment_email_subject_elem = this.$el.find('#' + this.fieldToSelectorMap['post_enrollment_email_subject']);
        this.post_enrollment_email_field = this.$el.find('#field-post-enrollment-email');
        this.post_enrollment_email_subject_field = this.$el.find('#field-post-enrollment-email-subject');

        this.enable_enrollment_email_box = this.$el.find('#' + this.fieldToSelectorMap['enable_enrollment_email'])[0];

        this.default_pre_template = this.$el.find('#default_pre_enrollment_email_template');
        this.default_post_template = this.$el.find('#default_post_enrollment_email_template');
    },

    render: function() {
        this.setupDatePicker('start_date');
        this.setupDatePicker('end_date');
        this.setupDatePicker('enrollment_start');
        this.setupDatePicker('enrollment_end');

        this.$el.find('#' + this.fieldToSelectorMap['overview']).val(this.model.get('overview'));
        this.codeMirrorize(null, $('#course-overview')[0]);

        this.pre_enrollment_email_subject_elem.val(this.model.get('pre_enrollment_email_subject'));
        this.post_enrollment_email_subject_elem.val(this.model.get('post_enrollment_email_subject'));

        this.pre_enrollment_email_elem.val(this.model.get('pre_enrollment_email'));
        this.codeMirrorize(null, $('#pre-enrollment-email')[0]);

        this.post_enrollment_email_elem.val(this.model.get('post_enrollment_email'));
        this.codeMirrorize(null, $('#post-enrollment-email')[0]);

        this.enable_enrollment_email_box.checked = this.model.get('enable_enrollment_email');

        if (this.enable_enrollment_email_box.checked) {
            this.enrollment_email_settings.show();
        } else {
            this.enrollment_email_settings.hide();
        }

        this.$el.find('#' + this.fieldToSelectorMap['short_description']).val(this.model.get('short_description'));

        this.$el.find('.current-course-introduction-video iframe').attr('src', this.model.videosourceSample());
        this.$el.find('#' + this.fieldToSelectorMap['intro_video']).val(this.model.get('intro_video') || '');
        if (this.model.has('intro_video')) {
            this.$el.find('.remove-course-introduction-video').show();
        }
        else this.$el.find('.remove-course-introduction-video').hide();

        this.$el.find('#' + this.fieldToSelectorMap['effort']).val(this.model.get('effort'));

        var imageURL = this.model.get('course_image_asset_path');
        this.$el.find('#course-image-url').val(imageURL);
        this.$el.find('#course-image').attr('src', imageURL);

        return this;
    },
    fieldToSelectorMap : {
        'start_date' : "course-start",
        'end_date' : 'course-end',
        'enrollment_start' : 'enrollment-start',
        'enrollment_end' : 'enrollment-end',
        'overview' : 'course-overview',
        'pre_enrollment_email' : 'pre-enrollment-email',
        'post_enrollment_email' : 'post-enrollment-email',
        'short_description' : 'course-short-description',
        'intro_video' : 'course-introduction-video',
        'effort' : "course-effort",
        'course_image_asset_path': 'course-image-url',
        'enable_enrollment_email': 'enable-enrollment-email',
        'pre_enrollment_email_subject' :'pre-enrollment-email-subject',
        'post_enrollment_email_subject':'post-enrollment-email-subject',
    },

    updateTime : function(e) {
        var now = new Date(),
            hours = now.getUTCHours(),
            minutes = now.getUTCMinutes(),
            currentTimeText = gettext('%(hours)s:%(minutes)s (current UTC time)');

        $(e.currentTarget).attr('title', interpolate(currentTimeText, {
            'hours': hours,
            'minutes': minutes
        }, true));
    },

    setupDatePicker: function (fieldName) {
        var cacheModel = this.model;
        var div = this.$el.find('#' + this.fieldToSelectorMap[fieldName]);
        var datefield = $(div).find("input:.date");
        var timefield = $(div).find("input:.time");
        var cachethis = this;
        var setfield = function () {
            var newVal = DateUtils.getDate(datefield, timefield);
            if (newVal) {
                if (!cacheModel.has(fieldName) || cacheModel.get(fieldName).getTime() !== newVal.getTime()) {
                    cachethis.clearValidationErrors();
                    cachethis.setAndValidate(fieldName, newVal);
                }
            }
            else {
                // Clear date (note that this clears the time as well, as date and time are linked).
                // Note also that the validation logic prevents us from clearing the start date
                // (start date is required by the back end).
                cachethis.clearValidationErrors();
                cachethis.setAndValidate(fieldName, null);
            }
        };

        // instrument as date and time pickers
        timefield.timepicker({'timeFormat' : 'H:i'});
        datefield.datepicker();

        // Using the change event causes setfield to be triggered twice, but it is necessary
        // to pick up when the date is typed directly in the field.
        datefield.change(setfield).keyup(TriggerChangeEventOnEnter);
        timefield.on('changeTime', setfield);
        timefield.on('input', setfield);

        date = this.model.get(fieldName)
        // timepicker doesn't let us set null, so check that we have a time
        if (date) {
            DateUtils.setDate(datefield, timefield, date);
        } // but reset fields either way
        else {
            timefield.val('');
            datefield.val('');
        }
    },

    updateModel: function(event) {
        switch (event.currentTarget.id) {
        case 'course-image-url':
            this.setField(event);
            var url = $(event.currentTarget).val();
            var image_name = _.last(url.split('/'));
            this.model.set('course_image_name', image_name);
            // Wait to set the image src until the user stops typing
            clearTimeout(this.imageTimer);
            this.imageTimer = setTimeout(function() {
                $('#course-image').attr('src', $(event.currentTarget).val());
            }, 1000);
            break;
        case 'course-effort':
            this.setField(event);
            break;
        case 'pre-enrollment-email-subject':
            this.setField(event);
            break;
        case 'post-enrollment-email-subject':
            this.setField(event);
            break;
        case 'course-short-description':
            this.setField(event);
            break;
        // Don't make the user reload the page to check the Youtube ID.
        // Wait for a second to load the video, avoiding egregious AJAX calls.
        case 'course-introduction-video':
            this.clearValidationErrors();
            var previewsource = this.model.set_videosource($(event.currentTarget).val());
            clearTimeout(this.videoTimer);
            this.videoTimer = setTimeout(_.bind(function() {
                this.$el.find(".current-course-introduction-video iframe").attr("src", previewsource);
                if (this.model.has('intro_video')) {
                    this.$el.find('.remove-course-introduction-video').show();
                }
                else {
                    this.$el.find('.remove-course-introduction-video').hide();
                }
            }, this), 1000);
            break;
        default: // Everything else is handled by datepickers and CodeMirror.
            break;
        }
    },

    removeVideo: function(event) {
        event.preventDefault();
        if (this.model.has('intro_video')) {
            this.model.set_videosource(null);
            this.$el.find(".current-course-introduction-video iframe").attr("src", "");
            this.$el.find('#' + this.fieldToSelectorMap['intro_video']).val("");
            this.$el.find('.remove-course-introduction-video').hide();
        }
    },

    toggleEnrollmentEmails: function(event) {
        var isChecked = this.enable_enrollment_email_box.checked;

        /* enable & disable default will show the template */
        if(isChecked) {
            this.enrollment_email_settings.slideDown();
        } else {
            this.enrollment_email_settings.slideUp();
        }

        var field = this.selectorToField['enable-enrollment-email'];
        if (this.model.get(field) != isChecked) {
            this.setAndValidate(field, isChecked);
        }
    },

    codeMirrors : {},
    codeMirrorize: function (e, forcedTarget) {
        var thisTarget;
        if (forcedTarget) {
            thisTarget = forcedTarget;
            thisTarget.id = $(thisTarget).attr('id');
        } else if (e !== null) {
            thisTarget = e.currentTarget;
        } else
        {
            // e and forcedTarget can be null so don't deference it
            // This is because in cases where we have a marketing site
            // we don't display the codeMirrors for editing the marketing
            // materials, except we do need to show the 'set course image'
            // workflow. So in this case e = forcedTarget = null.
            return;
        }

        if (!this.codeMirrors[thisTarget.id]) {
            var cachethis = this;
            var field = this.selectorToField[thisTarget.id];
            this.codeMirrors[thisTarget.id] = CodeMirror.fromTextArea(thisTarget, {
                mode: "text/html", lineNumbers: true, lineWrapping: true});
            this.codeMirrors[thisTarget.id].on('change', function (mirror) {
                    mirror.save();
                    cachethis.clearValidationErrors();
                    var newVal = mirror.getValue();
                    if (cachethis.model.get(field) != newVal) {
                        cachethis.setAndValidate(field, newVal);
                    }
            });
        }
    },

    revertView: function() {
        // Make sure that the CodeMirror instance has the correct
        // data from its corresponding textarea
        var self = this;
        this.model.fetch({
            success: function() {
                _.each(self.codeMirrors,
                       function(mirror) {
                           var ele = mirror.getTextArea();
                           var field = self.selectorToField[ele.id];
                           mirror.setValue(self.model.get(field));
                       });
                self.render();
            },
            reset: true,
            silent: true});
    },
    setAndValidate: function(attr, value) {
        // If we call model.set() with {validate: true}, model fields
        // will not be set if validation fails. This puts the UI and
        // the model in an inconsistent state, and causes us to not
        // see the right validation errors the next time validate() is
        // called on the model. So we set *without* validating, then
        // call validate ourselves.
        this.model.set(attr, value);
        this.model.isValid();
    },

    showNotificationBar: function() {
        // We always call showNotificationBar with the same args, just
        // delegate to superclass
        ValidatingView.prototype.showNotificationBar.call(this,
                                                          this.save_message,
                                                          _.bind(this.saveView, this),
                                                          _.bind(this.revertView, this));
    },

    uploadImage: function(event) {
        event.preventDefault();
        var upload = new FileUploadModel({
            title: gettext("Upload your course image."),
            message: gettext("Files must be in JPEG or PNG format."),
            mimeTypes: ['image/jpeg', 'image/png']
        });
        var self = this;
        var modal = new FileUploadDialog({
            model: upload,
            onSuccess: function(response) {
                var options = {
                    'course_image_name': response.asset.display_name,
                    'course_image_asset_path': response.asset.url
                };
                self.model.set(options);
                self.render();
                $('#course-image').attr('src', self.model.get('course_image_asset_path'));
            }
        });
        modal.show();
    },

    sendTestEmail: function (event) {
        event.preventDefault();
        var email_type = event.target.id;
        var subject = "";
        var message = "";
        if (email_type === "test_email_pre") {
            subject = this.pre_enrollment_email_subject_elem.val();
            message = this.pre_enrollment_email_elem.val();
        } else {
            subject = this.post_enrollment_email_subject_elem.val();
            message = this.post_enrollment_email_elem.val();
        }

        console.log($(this).data('test-url'));
        $.post($(this).data('test-url'),
               {
                 subject: subject,
                 message:message
               },
               function (data) {
                   alert(gettext("Test email sent! Please check your inbox. Don't forget to save!"));
               }
        );
    },

    showDefaultTemplate: function (event) {
        event.preventDefault();

        var content = "";
        var codeMirrorItem;
        var oldContent = "";
        var target_id = event.target.id;

        if (target_id === "fill_default_email_pre") {
            content = $('#default_pre_enrollment_email_template').text();
            codeMirrorItem = this.codeMirrors[this.pre_enrollment_email_elem[0].id];
            oldContent = codeMirrorItem.getValue();
        } else {
            content = $('#default_post_enrollment_email_template').text();
            codeMirrorItem = this.codeMirrors[this.post_enrollment_email_elem[0].id];
            oldContent = codeMirrorItem.getValue();
        }

        if (oldContent.trim() !== "") {
            var confirmed = confirm(gettext("This will overwrite the current message with the default one. Do you wish to continue?"));
            if (!confirmed) return;
        }
        codeMirrorItem.setValue(content);
    }
});

return DetailsView;

}); // end define()
