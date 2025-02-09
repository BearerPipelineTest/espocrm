/************************************************************************
 * This file is part of EspoCRM.
 *
 * EspoCRM - Open Source CRM application.
 * Copyright (C) 2014-2022 Yurii Kuznietsov, Taras Machyshyn, Oleksii Avramenko
 * Website: https://www.espocrm.com
 *
 * EspoCRM is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * EspoCRM is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EspoCRM. If not, see http://www.gnu.org/licenses/.
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License version 3,
 * these Appropriate Legal Notices must retain the display of the "EspoCRM" word.
 ************************************************************************/

define('views/fields/attachment-multiple', ['views/fields/base', 'helpers/file-upload'],
function (Dep, FileUpload) {

    /**
     * @class
     * @name Class
     * @extends module:views/fields/base.Class
     * @memberOf module:views/fields/attachment-multiple
     */
    return Dep.extend(/** @lends module:views/fields/attachment-multiple.Class# */{

        type: 'attachmentMultiple',

        listTemplate: 'fields/attachments-multiple/list',

        detailTemplate: 'fields/attachments-multiple/detail',

        editTemplate: 'fields/attachments-multiple/edit',

        searchTemplate: 'fields/link-multiple/search',

        previewSize: 'medium',

        nameHashName: null,

        idsName: null,

        nameHash: null,

        foreignScope: null,

        showPreviews: true,

        accept: null,

        validations: ['ready', 'required'],

        searchTypeList: ['isNotEmpty', 'isEmpty'],

        events: {
            'click a.remove-attachment': function (e) {
                var $div = $(e.currentTarget).parent();

                var id = $div.attr('data-id');

                if (id) {
                    this.deleteAttachment(id);
                }

                $div.parent().remove();

                this.$el.find('input.file').val(null);
            },
            'change input.file': function (e) {
                let $file = $(e.currentTarget);
                let files = e.currentTarget.files;

                this.uploadFiles(files);

                e.target.value = null;

                $file.replaceWith($file.clone(true));
            },
            'click a.action[data-action="insertFromSource"]': function (e) {
                var name = $(e.currentTarget).data('name');
                this.insertFromSource(name);
            },
            'click a[data-action="showImagePreview"]': function (e) {
                e.preventDefault();

                var id = $(e.currentTarget).data('id');

                var attachmentIdList = this.model.get(this.idsName) || [];
                var typeHash = this.model.get(this.typeHashName) || {};

                var imageIdList = [];

                attachmentIdList.forEach(cId => {
                    if (!this.isTypeIsImage(typeHash[cId])) {
                        return;
                    }

                    imageIdList.push(cId);
                });

                var imageList = [];

                imageIdList.forEach((cId) => {
                    imageList.push({
                        id: cId,
                        name: this.nameHash[cId]
                    });
                });

                this.createView('preview', 'views/modals/image-preview', {
                    id: id,
                    model: this.model,
                    name: this.nameHash[id],
                    imageList: imageList
                }, (view) => {
                    view.render();
                });
            },
            'keydown label.attach-file-label': function (e) {
                let key = Espo.Utils.getKeyFromKeyEvent(e);

                if (key === 'Enter') {
                    this.$el.find('input.file').get(0).click();
                }
            },
        },

        data: function () {
            var ids = this.model.get(this.idsName);

            var data = _.extend({
                idValues: this.model.get(this.idsName),
                idValuesString: ids ? ids.join(',') : '',
                nameHash: this.model.get(this.nameHashName),
                foreignScope: this.foreignScope,
                valueIsSet: this.model.has(this.idsName),
                acceptAttribute: this.acceptAttribute,
            }, Dep.prototype.data.call(this));

            if (this.mode === 'edit') {
                data.fileSystem = ~this.sourceList.indexOf('FileSystem');
                data.sourceList = this.sourceList;
            }

            return data;
        },

        setup: function () {
            this.nameHashName = this.name + 'Names';
            this.typeHashName = this.name + 'Types';
            this.idsName = this.name + 'Ids';
            this.foreignScope = 'Attachment';

            this.previewSize = this.options.previewSize || this.params.previewSize || this.previewSize;

            this.previewTypeList = this.getMetadata().get(['app', 'image', 'previewFileTypeList']) || [];
            this.imageSizes = this.getMetadata().get(['app', 'image', 'sizes']) || {};

            this.nameHash = _.clone(this.model.get(this.nameHashName)) || {};

            if ('showPreviews' in this.params) {
                this.showPreviews = this.params.showPreviews;
            }

            if ('accept' in this.params) {
                this.accept = this.params.accept;
            }

            if (this.accept && this.accept.length) {
                this.acceptAttribute = this.accept.join(', ');
            }

            var sourceDefs = this.getMetadata().get(['clientDefs', 'Attachment', 'sourceDefs']) || {};

            this.sourceList = Espo.Utils.clone(this.params.sourceList || []);

            this.sourceList = this.sourceList
                .concat(
                    this.getMetadata().get(['clientDefs', 'Attachment', 'generalSourceList']) || []
                )
                .filter((item, i, self) => {
                    return self.indexOf(item) === i;
                })
                .filter((item) => {
                    var defs = sourceDefs[item] || {};

                    if (defs.accessDataList) {
                        if (
                            !Espo.Utils.checkAccessDataList(
                                defs.accessDataList, this.getAcl(), this.getUser()
                            )
                        ) {
                            return false;
                        }
                    }

                    if (defs.configCheck) {
                        var arr = defs.configCheck.split('.');

                        if (!this.getConfig().getByPath(arr)) {
                            return false;
                        }
                    }

                    return true;
                });

            this.listenTo(this.model, 'change:' + this.nameHashName, () => {
                this.nameHash = _.clone(this.model.get(this.nameHashName)) || {};
            });

            this.once('remove', () => {
                if (this.resizeIsBeingListened) {
                    $(window).off('resize.' + this.cid);
                }
            });

            this.on('inline-edit-off', () => {
                this.isUploading = false;
            });
        },

        setupSearch: function () {
            this.events = _.extend({
                'change select.search-type': (e) => {
                    var type = $(e.currentTarget).val();

                    this.handleSearchType(type);
                },
            }, this.events || {});
        },

        focusOnInlineEdit: function () {
            this.$el.find('.attach-file-label').focus();
        },

        empty: function () {
            this.clearIds();

            this.$attachments.empty();
        },

        handleResize: function () {
            var width = this.$el.width();

            this.$el.find('img.image-preview').css('maxWidth', width + 'px');
        },

        deleteAttachment: function (id) {
            this.removeId(id);

            if (this.model.isNew()) {
                this.getModelFactory().create('Attachment', (attachment) => {
                    attachment.id = id;
                    attachment.destroy();
                });
            }
        },

        getImageUrl: function (id, size) {
            var url = this.getBasePath() + '?entryPoint=image&id=' + id;

            if (size) {
                url += '&size=' + size;
            }

            if (this.getUser().get('portalId')) {
                url += '&portalId=' + this.getUser().get('portalId');
            }

            return url;
        },

        getDownloadUrl: function (id) {
            let url = this.getBasePath() + '?entryPoint=download&id=' + id;

            if (this.getUser().get('portalId')) {
                url += '&portalId=' + this.getUser().get('portalId');
            }

            return url;
        },

        removeId: function (id) {
            var arr = _.clone(this.model.get(this.idsName) || []);
            var i = arr.indexOf(id);

            arr.splice(i, 1);

            this.model.set(this.idsName, arr);

            var nameHash = _.clone(this.model.get(this.nameHashName) || {});
            delete nameHash[id];

            this.model.set(this.nameHashName, nameHash);

            var typeHash = _.clone(this.model.get(this.typeHashName) || {});
            delete typeHash[id];

            this.model.set(this.typeHashName, typeHash);
        },

        clearIds: function (silent) {
            silent = silent || false;

            this.model.set(this.idsName, [], {silent: silent});
            this.model.set(this.nameHashName, {}, {silent: silent});
            this.model.set(this.typeHashName, {}, {silent: silent})
        },

        pushAttachment: function (attachment, link, ui) {
            var arr = _.clone(this.model.get(this.idsName) || []);

            arr.push(attachment.id);

            this.model.set(this.idsName, arr, {ui: ui});

            var typeHash = _.clone(this.model.get(this.typeHashName) || {});

            typeHash[attachment.id] = attachment.get('type');

            this.model.set(this.typeHashName, typeHash, {ui: ui});

            var nameHash = _.clone(this.model.get(this.nameHashName) || {});

            nameHash[attachment.id] = attachment.get('name');

            this.model.set(this.nameHashName, nameHash, {ui: ui});
        },

        getEditPreview: function (name, type, id) {
            if (!~this.previewTypeList.indexOf(type)) {
                return name;
            }

            return  $('<img>')
                .attr('src', this.getImageUrl(id, 'small'))
                .attr('title', name)
                .attr('draggable', false)
                .css({
                    maxWidth: (this.imageSizes[this.previewSize] || {})[0],
                    maxHeight: (this.imageSizes[this.previewSize] || {})[1],
                })
                .get(0)
                .outerHTML;
        },

        getBoxPreviewHtml: function (name, type, id) {
            let $text = $('<span>').text(name);

            if (!id) {
                return $text.get(0).outerHTML;
            }

            if (this.showPreviews) {
                let html = this.getEditPreview(name, type, id);

                if (!html) {
                    return $text.get(0).outerHTML;
                }

                return html;
            }

            let url = this.getBasePath() + '?entryPoint=download&id=' + id;

            return $('<a>')
                .attr('href', url)
                .attr('target', '_BLANK')
                .text(name)
                .get(0).outerHTML;
        },

        addAttachmentBox: function (name, type, id) {
            let $attachments = this.$attachments;

            let $remove = $('<a>')
                .attr('role', 'button')
                .attr('tabindex', '0')
                .addClass('remove-attachment pull-right')
                .append(
                    $('<span>').addClass('fas fa-times')
                );

            let previewHtml = this.getBoxPreviewHtml(name, type, id);

            let $att = $('<div>')
                .addClass('gray-box')
                .append($remove)
                .append(
                    $('<span>')
                        .addClass('preview')
                        .append(previewHtml)
                );

            let $container = $('<div>').append($att);

            $attachments.append($container);

            if (id) {
                $att.attr('data-id', id);

                return $att;
            }

            let $loading = $('<span>')
                .addClass('small uploading-message')
                .text(this.translate('Uploading...'));

            $container.append($loading);

            $att.on('ready', () => {
                $loading.html(this.translate('Ready'));

                let id = $att.attr('data-id');

                let previewHtml = this.getBoxPreviewHtml(name, type, id);

                $att.find('.preview').html(previewHtml);

                if ($att.find('.preview').find('img').length) {
                    $loading.remove();
                }
            });

            return $att;
        },

        showValidationMessage: function (msg, selector) {
            var $label = this.$el.find('label');
            var title = $label.attr('title');

            $label.attr('title', '');

            Dep.prototype.showValidationMessage.call(this, msg, selector);

            $label.attr('title', title);
        },

        getMaxFileSize: function () {
            let maxFileSize = this.params.maxFileSize || 0;

            let noChunk = !this.getConfig().get('attachmentUploadChunkSize');
            let attachmentUploadMaxSize = this.getConfig().get('attachmentUploadMaxSize') || 0;
            let appMaxUploadSize = this.getHelper().getAppParam('maxUploadSize') || 0;

            if (!maxFileSize || maxFileSize > attachmentUploadMaxSize) {
                maxFileSize = attachmentUploadMaxSize;
            }

            if (noChunk && maxFileSize > appMaxUploadSize) {
                maxFileSize = appMaxUploadSize;
            }

            return maxFileSize;
        },

        uploadFiles: function (files) {
            let uploadedCount = 0;
            let totalCount = 0;

            let exceedsMaxFileSize = false;

            let maxFileSize = this.getMaxFileSize();

            if (maxFileSize) {
                for (let i = 0; i < files.length; i++) {
                    let file = files[i];

                    if (file.size > maxFileSize * 1024 * 1024) {
                        exceedsMaxFileSize = true;
                    }
                }
            }

            if (exceedsMaxFileSize) {
                let msg = this.translate('fieldMaxFileSizeError', 'messages')
                    .replace('{field}', this.getLabelText())
                    .replace('{max}', maxFileSize);

                this.showValidationMessage(msg, 'label');

                return;
            }

            this.isUploading = true;

            this.getModelFactory().create('Attachment', model => {
                let canceledList = [];

                let fileList = [];

                for (let i = 0; i < files.length; i++) {
                    fileList.push(files[i]);

                    totalCount++;
                }

                /** @type module:helpers/file-upload.Class */
                let uploadHelper = new FileUpload(this.getConfig());

                fileList.forEach(file => {
                    let $attachmentBox = this.addAttachmentBox(file.name, file.type);

                    let $uploadingMsg = $attachmentBox.parent().find('.uploading-message');

                    let mediator = {};

                    $attachmentBox.find('.remove-attachment').on('click.uploading', () => {
                        canceledList.push(attachment.cid);

                        totalCount--;

                        if (uploadedCount === totalCount) {
                            this.isUploading = false;

                            if (totalCount) {
                                this.afterAttachmentsUploaded.call(this);
                            }
                        }

                        mediator.isCanceled = true;
                    });

                    let attachment = model.clone();

                    attachment.set('role', 'Attachment');
                    attachment.set('parentType', this.model.name);
                    attachment.set('field', this.name);

                    uploadHelper
                        .upload(file, attachment, {
                            afterChunkUpload: (size) => {
                                let msg = Math.floor((size / file.size) * 100) + '%';

                                $uploadingMsg.html(msg);
                            },
                            afterAttachmentSave: (attachment) => {
                                $attachmentBox.attr('data-id', attachment.id);
                            },
                            mediator: mediator,
                        })
                        .then(() => {
                            if (canceledList.indexOf(attachment.cid) !== -1) {
                                return;
                            }

                            this.pushAttachment(attachment, null, true);

                            $attachmentBox.attr('data-id', attachment.id);
                            $attachmentBox.trigger('ready');

                            uploadedCount++;

                            if (uploadedCount === totalCount && this.isUploading) {
                                this.model.trigger('attachment-uploaded:' + this.name);
                                this.afterAttachmentsUploaded.call(this);

                                this.isUploading = false;
                            }
                        })
                        .catch(() => {
                            if (mediator.isCanceled) {
                                return;
                            }

                            $attachmentBox.remove();
                            $uploadingMsg.remove();

                            totalCount--;

                            if (!totalCount) {
                                this.isUploading = false;
                            }

                            if (uploadedCount === totalCount && this.isUploading) {
                                this.isUploading = false;
                                this.afterAttachmentsUploaded.call(this);
                            }
                        });
                });
            });
        },

        afterAttachmentsUploaded: function () {},

        afterRender: function () {
            if (this.mode === 'edit') {
                this.$attachments = this.$el.find('div.attachments');

                let ids = this.model.get(this.idsName) || [];

                let hameHash = this.model.get(this.nameHashName);
                let typeHash = this.model.get(this.typeHashName) || {};

                ids.forEach(id => {
                    if (hameHash) {
                        let name = hameHash[id];
                        let type = typeHash[id] || null;

                        this.addAttachmentBox(name, type, id);
                    }
                });

                this.$el.off('drop');
                this.$el.off('dragover');
                this.$el.off('dragleave');

                this.$el.on('drop', e => {
                    e.preventDefault();
                    e.stopPropagation();

                    event = e.originalEvent;

                    if (
                        event.dataTransfer &&
                        event.dataTransfer.files &&
                        event.dataTransfer.files.length
                    ) {
                        this.uploadFiles(event.dataTransfer.files);
                    }
                });

                this.$el.get(0).addEventListener('dragover', e => {
                    e.preventDefault();
                });

                this.$el.get(0).addEventListener('dragleave', e => {
                    e.preventDefault();
                });
            }

            if (this.mode === 'search') {
                let type = this.$el.find('select.search-type').val();

                this.handleSearchType(type);
            }

            if (this.mode === 'detail') {
                if (this.previewSize === 'large') {
                    this.handleResize();
                    this.resizeIsBeingListened = true;

                    $(window).on('resize.' + this.cid, () => {
                        this.handleResize();
                    });
                }
            }
        },

        isTypeIsImage: function (type) {
            if (~this.previewTypeList.indexOf(type)) {
                return true;
            }

            return false;
        },

        /**
         * @return {string}
         */
        getDetailPreview: function (name, type, id) {
            if (!this.isTypeIsImage(type)) {
                return $('<span>')
                    .text(name)
                    .get(0)
                    .outerHTML;
            }

            return $('<a>')
                .attr('data-action', 'showImagePreview')
                .attr('data-id', id)
                .attr('title', name)
                .attr('href', this.getImageUrl(id))
                .append(
                    $('<img>')
                        .attr('src', this.getImageUrl(id, this.previewSize))
                        .addClass('image-preview')
                        .css({
                            maxWidth: (this.imageSizes[this.previewSize] || {})[0],
                            maxHeight: (this.imageSizes[this.previewSize] || {})[1],
                        })
                )
                .get(0)
                .outerHTML;
        },

        getValueForDisplay: function () {
            if (this.isDetailMode() || this.isListMode()) {
                let nameHash = this.nameHash;
                let typeHash = this.model.get(this.typeHashName) || {};

                let previews = [];
                let names = [];

                for (let id in nameHash) {
                    let type = typeHash[id] || false;
                    let name = nameHash[id];

                    if (
                        this.showPreviews &&
                        ~this.previewTypeList.indexOf(type) &&
                        (
                            this.isDetailMode() ||
                            this.isListMode() && this.showPreviewsInListMode
                        )
                    ) {
                        previews.push(
                            $('<div>')
                                .addClass('attachment-preview')
                                .append(this.getDetailPreview(name, type, id))
                        );

                        continue;
                    }

                    names.push(
                        $('<div>')
                            .addClass('attachment-block')
                            .append(
                                $('<span>').addClass('fas fa-paperclip text-soft small'),
                                ' ',
                                $('<a>')
                                    .attr('href', this.getDownloadUrl(id))
                                    .attr('target', '_BLANK')
                                    .text(name)
                            )
                    );
                }

                let containerClassName = null;

                if (this.previewSize === 'large') {
                    containerClassName = 'attachment-block-container-large';
                }

                if (this.previewSize === 'small') {
                    containerClassName = 'attachment-block-container-small';
                }

                if (names.length === 0 && previews.length === 0) {
                    return '';
                }

                let $container = $('<div>')
                    .append(
                        $('<div>')
                            .addClass('attachment-block-container')
                            .addClass(containerClassName)
                            .append(previews)
                    )
                    .append(names);

                return $container.get(0).innerHTML;
            }
        },

        insertFromSource: function (source) {
            var viewName =
                this.getMetadata().get(['clientDefs', 'Attachment', 'sourceDefs', source, 'insertModalView']) ||
                this.getMetadata().get(['clientDefs', source, 'modalViews', 'select']) ||
                'views/modals/select-records';

            if (viewName) {
                this.notify('Loading...');

                var filters = null;

                if (('getSelectFilters' + source) in this) {
                    filters = this['getSelectFilters' + source]();

                    if (this.model.get('parentId') && this.model.get('parentType') === 'Account') {
                        if (
                            this.getMetadata()
                                .get(['entityDefs', source, 'fields', 'account', 'type']) === 'link'
                        ) {
                            filters = {
                                account: {
                                    type: 'equals',
                                    field: 'accountId',
                                    value: this.model.get('parentId'),
                                    valueName: this.model.get('parentName')
                                }
                            };
                        }
                    }
                }

                var boolFilterList = this.getMetadata()
                    .get(['clientDefs', 'Attachment', 'sourceDefs', source, 'boolFilterList']);

                if (('getSelectBoolFilterList' + source) in this) {
                    boolFilterList = this['getSelectBoolFilterList' + source]();
                }

                var primaryFilterName = this.getMetadata()
                    .get(['clientDefs', 'Attachment', 'sourceDefs', source, 'primaryFilter']);

                if (('getSelectPrimaryFilterName' + source) in this) {
                    primaryFilterName = this['getSelectPrimaryFilterName' + source]();
                }

                this.createView('insertFromSource', viewName, {
                    scope: source,
                    createButton: false,
                    filters: filters,
                    boolFilterList: boolFilterList,
                    primaryFilterName: primaryFilterName,
                    multiple: true,
                }, (view) => {
                    view.render();

                    this.notify(false);

                    this.listenToOnce(view, 'select', (modelList) =>{
                        if (Object.prototype.toString.call(modelList) !== '[object Array]') {
                            modelList = [modelList];
                        }

                        modelList.forEach(model => {
                            if (model.name === 'Attachment') {
                                this.pushAttachment(model);

                                return;
                            }

                            Espo.Ajax
                                .postRequest(source + '/action/getAttachmentList', {id: model.id})
                                .then(attachmentList => {
                                    attachmentList.forEach(item => {
                                        this.getModelFactory().create('Attachment', attachment => {
                                            attachment.set(item);

                                            this.pushAttachment(attachment, true);
                                        });
                                    });
                                });
                        });
                    });
                });
            }
        },

        validateRequired: function () {
            if (this.isRequired()) {
                if ((this.model.get(this.idsName) || []).length === 0) {
                    var msg = this.translate('fieldIsRequired', 'messages')
                        .replace('{field}', this.getLabelText());

                    this.showValidationMessage(msg, 'label');

                    return true;
                }
            }
        },

        validateReady: function () {
            if (this.isUploading) {
                var msg = this.translate('fieldIsUploading', 'messages')
                    .replace('{field}', this.getLabelText());

                this.showValidationMessage(msg, 'label');

                return true;
            }
        },

        fetch: function () {
            var data = {};

            data[this.idsName] = this.model.get(this.idsName) || [];

            return data;
        },

        handleSearchType: function (type) {
            this.$el.find('div.link-group-container').addClass('hidden');
        },

        fetchSearch: function () {
            let type = this.$el.find('select.search-type').val();

            if (type === 'isEmpty') {
                return {
                    type: 'isNotLinked',
                    data: {
                        type: type,
                    },
                };
            }

            if (type === 'isNotEmpty') {
                return {
                    type: 'isLinked',
                    data: {
                        type: type,
                    },
                };
            }

            return null;
        },
    });
});
