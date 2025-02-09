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

define('views/fields/file', ['views/fields/link', 'helpers/file-upload'], function (Dep, FileUpload) {

    /**
     * A file field.
     *
     * @class
     * @name Class
     * @extends module:views/fields/link.Class
     * @memberOf module:views/fields/file
     */
    return Dep.extend(/** @lends module:views/fields/file.Class# */{

        type: 'file',

        listTemplate: 'fields/file/list',

        listLinkTemplate: 'fields/file/list',

        detailTemplate: 'fields/file/detail',

        editTemplate: 'fields/file/edit',

        showPreview: false,

        accept: false,

        defaultType: false,

        previewSize: 'small',

        validations: ['ready', 'required'],

        searchTypeList: ['isNotEmpty', 'isEmpty'],

        ROW_HEIGHT: 35,

        events: {
            'click a.remove-attachment': function (e) {
                var $div = $(e.currentTarget).parent();

                this.deleteAttachment();

                $div.parent().remove();

                this.$el.find('input.file').val(null);
            },
            'change input.file': function (e) {
                let $file = $(e.currentTarget);
                let files = e.currentTarget.files;

                if (!files.length) {
                    return;
                }

                this.uploadFile(files[0]);

                e.target.value = null;

                $file.replaceWith($file.clone(true));
            },
            'click a[data-action="showImagePreview"]': function (e) {
                e.preventDefault();

                var id = this.model.get(this.idName);

                this.createView('preview', 'views/modals/image-preview', {
                    id: id,
                    model: this.model,
                    name: this.model.get(this.nameName),
                }, (view) => {
                    view.render();
                });
            },
            'click a.action[data-action="insertFromSource"]': function (e) {
                var name = $(e.currentTarget).data('name');

                this.insertFromSource(name);
            },
            'keydown label.attach-file-label': function (e) {
                let key = Espo.Utils.getKeyFromKeyEvent(e);

                if (key === 'Enter') {
                    this.$el.find('input.file').get(0).click();
                }
            },
        },

        data: function () {
            var data =_.extend({
                id: this.model.get(this.idName),
                acceptAttribute: this.acceptAttribute,
            }, Dep.prototype.data.call(this));

            if (this.mode === 'edit') {
                data.sourceList = this.sourceList;
            }

            data.valueIsSet = this.model.has(this.idName);

            return data;
        },

        showValidationMessage: function (msg, selector) {
            var $label = this.$el.find('label');

            var title = $label.attr('title');

            $label.attr('title', '');

            Dep.prototype.showValidationMessage.call(this, msg, selector);

            $label.attr('title', title);
        },

        validateRequired: function () {
            if (this.isRequired()) {
                if (this.model.get(this.idName) == null) {
                    var msg = this.translate('fieldIsRequired', 'messages')
                        .replace('{field}', this.getLabelText());

                    var $target;

                    if (this.isUploading) {
                        $target = this.$el.find('.gray-box');
                    }
                    else {
                        $target = this.$el.find('.attachment-button label');
                    }

                    this.showValidationMessage(msg, $target);

                    return true;
                }
            }
        },

        validateReady: function () {
            if (this.isUploading) {
                var $target = this.$el.find('.gray-box');

                var msg = this.translate('fieldIsUploading', 'messages')
                    .replace('{field}', this.getLabelText());

                this.showValidationMessage(msg, $target);

                return true;
            }
        },

        setup: function () {
            this.nameName = this.name + 'Name';
            this.idName = this.name + 'Id';
            this.typeName = this.name + 'Type';
            this.foreignScope = 'Attachment';

            this.previewSize = this.options.previewSize || this.params.previewSize || this.previewSize;

            this.previewTypeList = this.getMetadata().get(['app', 'image', 'previewFileTypeList']) || [];
            this.imageSizes = this.getMetadata().get(['app', 'image', 'sizes']) || {};

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

            if ('showPreview' in this.params) {
                this.showPreview = this.params.showPreview;
            }

            if ('accept' in this.params) {
                this.accept = this.params.accept;
            }

            if (this.accept && this.accept.length) {
                this.acceptAttribute = this.accept.join(', ');
            }

            this.once('remove', () => {
                if (this.resizeIsBeingListened) {
                    $(window).off('resize.' + this.cid);
                }
            });

            this.on('inline-edit-off', () => {
                this.isUploading = false;
            });
        },

        afterRender: function () {
            if (this.mode === 'edit') {
                this.$attachment = this.$el.find('div.attachment');

                let name = this.model.get(this.nameName);
                let type = this.model.get(this.typeName) || this.defaultType;
                let id = this.model.get(this.idName);

                if (id) {
                    this.addAttachmentBox(name, type, id);
                }

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
                        this.uploadFile(event.dataTransfer.files[0]);
                    }
                });

                this.$el.on('dragover', e => {
                    e.preventDefault();
                });

                this.$el.on('dragleave', e =>{
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

        focusOnInlineEdit: function () {
            let $element = this.$el.find('.attach-file-label');

            if ($element.length) {
                $element.focus();
            }
        },

        handleResize: function () {
            let width = this.$el.width();

            this.$el.find('img.image-preview').css('maxWidth', width + 'px');
        },

        /**
         * @return {string}
         */
        getDetailPreview: function (name, type, id) {
            if (!~this.previewTypeList.indexOf(type)) {
                return name;
            }

            let previewSize = this.previewSize;

            if (this.isListMode()) {
                previewSize = 'small';

                if (this.params.listPreviewSize) {
                    previewSize = this.params.listPreviewSize;
                }
            }

            let src = this.getBasePath() + '?entryPoint=image&size=' + previewSize + '&id=' + id;

            let maxHeight = (this.imageSizes[this.previewSize] || {})[1];

            if (this.isListMode()) {
                maxHeight = this.ROW_HEIGHT + 'px';
            }

            let $img = $('<img>')
                .attr('src', src)
                .addClass('image-preview')
                .css({
                    maxWidth: (this.imageSizes[this.previewSize] || {})[0],
                    maxHeight: maxHeight,
                });

            if (this.mode === 'listLink') {
                let link = '#' + this.model.entityType + '/view/' + this.model.id;

                return $('<a>')
                    .attr('href', link)
                    .append($img)
                    .get(0)
                    .outerHTML;
            }

            return $('<a>')
                .attr('data-action', 'showImagePreview')
                .attr('data-id', id)
                .attr('title', name)
                .attr('href', this.getImageUrl(id))
                .append($img)
                .get(0)
                .outerHTML;
        },

        getEditPreview: function (name, type, id) {
            if (!~this.previewTypeList.indexOf(type)) {
                return null;
            }

            return $('<img>')
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

        getValueForDisplay: function () {
            if (! (this.isDetailMode() || this.isListMode())) {
                return '';
            }

            var name = this.model.get(this.nameName);
            var type = this.model.get(this.typeName) || this.defaultType;
            var id = this.model.get(this.idName);

            if (!id) {
                return false;
            }

            if (this.showPreview && ~this.previewTypeList.indexOf(type)) {
                let className = '';

                if (this.isListMode() && this.params.listPreviewSize) {
                    className += 'no-shrink';
                }

                let $item = $('<div>')
                    .addClass('attachment-preview')
                    .addClass(className)
                    .append(
                        this.getDetailPreview(name, type, id)
                    );

                let containerClassName = 'attachment-block-container';

                if (this.previewSize === 'large') {
                    containerClassName += ' attachment-block-container-large';
                }

                if (this.previewSize === 'small') {
                    containerClassName += ' attachment-block-container-small';
                }

                return $('<div>')
                    .addClass(containerClassName)
                    .append(
                        $('<div>')
                            .addClass('attachment-block')
                            .append($item)
                    )
                    .get(0).outerHTML;
            }

            return $('<span>')
                .append(
                    $('<span>').addClass('fas fa-paperclip text-soft small'),
                    ' ',
                    $('<a>')
                        .attr('href', this.getDownloadUrl(id))
                        .attr('target', '_BLANK')
                        .text(name)
                )
                .get(0).innerHTML;
        },

        getImageUrl: function (id, size) {
            let url = this.getBasePath() + '?entryPoint=image&id=' + id;

            if (size) {
                url += '&size=' + size;
            }

            if (this.getUser().get('portalId')) {
                url += '&portalId=' + this.getUser().get('portalId');
            }

            return url;
        },

        getDownloadUrl: function (id) {
            var url = this.getBasePath() + '?entryPoint=download&id=' + id;

            if (this.getUser().get('portalId')) {
                url += '&portalId=' + this.getUser().get('portalId');
            }

            return url;
        },

        deleteAttachment: function () {
            var id = this.model.get(this.idName);

            var o = {};

            o[this.idName] = null;
            o[this.nameName] = null;

            this.model.set(o);

            this.$attachment.empty();

            if (id) {
                if (this.model.isNew()) {
                    this.getModelFactory().create('Attachment', (attachment) => {
                        attachment.id = id;
                        attachment.destroy();
                    });
                }
            }
        },

        setAttachment: function (attachment, ui) {
            var o = {};

            o[this.idName] = attachment.id;
            o[this.nameName] = attachment.get('name');

            this.model.set(o, {ui: ui});
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

        uploadFile: function (file) {
            let isCanceled = false;

            let exceedsMaxFileSize = false;

            let maxFileSize = this.getMaxFileSize();

            if (maxFileSize) {
                if (file.size > maxFileSize * 1024 * 1024) {
                    exceedsMaxFileSize = true;
                }
            }

            if (exceedsMaxFileSize) {
                let msg = this.translate('fieldMaxFileSizeError', 'messages')
                    .replace('{field}', this.getLabelText())
                    .replace('{max}', maxFileSize);

                this.showValidationMessage(msg, '.attachment-button label');

                return;
            }

            this.isUploading = true;

            let uploadHelper = new FileUpload(this.getConfig());

            this.getModelFactory().create('Attachment', attachment => {
                let $attachmentBox = this.addAttachmentBox(file.name, file.type);

                let $uploadingMsg = $attachmentBox.parent().find('.uploading-message');

                this.$el.find('.attachment-button').addClass('hidden');

                let mediator = {};

                $attachmentBox.find('.remove-attachment').on('click.uploading', () => {
                    isCanceled = true;
                    this.isUploading = false;

                    this.$el.find('.attachment-button').removeClass('hidden');
                    this.$el.find('input.file').val(null);

                    mediator.isCanceled = true;
                });

                attachment.set('role', 'Attachment');
                attachment.set('relatedType', this.model.name);
                attachment.set('field', this.name);

                this.handleUploadingFile(file).then(file => {
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
                            if (isCanceled) {
                                return;
                            }

                            if (!this.isUploading) {
                                return;
                            }

                            this.setAttachment(attachment, true);

                            $attachmentBox.trigger('ready');

                            this.isUploading = false;
                        })
                        .catch(() => {
                            if (mediator.isCanceled) {
                                return;
                            }

                            $attachmentBox.remove();

                            this.$el.find('.uploading-message').remove();
                            this.$el.find('.attachment-button').removeClass('hidden');

                            this.isUploading = false;
                        });
                });
            });
        },

        handleUploadingFile: function (file) {
            return new Promise(resolve => resolve(file));
        },

        getBoxPreviewHtml: function (name, type, id) {
            let $text = $('<span>').text(name);

            if (!id) {
                return $text.get(0).outerHTML;
            }

            if (this.showPreview) {
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
            this.$attachment.empty();

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

            this.$attachment.append($container);

            if (id) {
                return $att;
            }

            let $loading = $('<span>')
                .addClass('small uploading-message')
                .text(this.translate('Uploading...'));

            $container.append($loading);

            $att.on('ready', () => {
                let id = this.model.get(this.idName);

                let previewHtml = this.getBoxPreviewHtml(name, type, id);

                $att.find('.preview').html(previewHtml);

                $loading.html(this.translate('Ready'));

                if ($att.find('.preview').find('img').length) {
                    $loading.remove();
                }
            });

            return $att;
        },

        insertFromSource: function (source) {
            var viewName =
                this.getMetadata()
                    .get(['clientDefs', 'Attachment', 'sourceDefs', source, 'insertModalView']) ||
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
                                    valueName: this.model.get('parentName'),
                                }
                            };
                        }
                    }
                }

                var boolFilterList = this.getMetadata().get(
                    ['clientDefs', 'Attachment', 'sourceDefs', source, 'boolFilterList']
                );

                if (('getSelectBoolFilterList' + source) in this) {
                    boolFilterList = this['getSelectBoolFilterList' + source]();
                }

                var primaryFilterName = this.getMetadata().get(
                    ['clientDefs', 'Attachment', 'sourceDefs', source, 'primaryFilter']
                );

                if (('getSelectPrimaryFilterName' + source) in this) {
                    primaryFilterName = this['getSelectPrimaryFilterName' + source]();
                }

                this.createView('insertFromSource', viewName, {
                    scope: source,
                    createButton: false,
                    filters: filters,
                    boolFilterList: boolFilterList,
                    primaryFilterName: primaryFilterName,
                    multiple: false,
                }, (view) => {
                    view.render();

                    this.notify(false);

                    this.listenToOnce(view, 'select', (modelList) => {
                        if (Object.prototype.toString.call(modelList) !== '[object Array]') {
                            modelList = [modelList];
                        }

                        modelList.forEach((model) => {
                            if (model.name === 'Attachment') {
                                this.setAttachment(model);

                                return;
                            }

                            Espo.Ajax
                                .postRequest(source + '/action/getAttachmentList', {id: model.id})
                                .then(attachmentList => {
                                    attachmentList.forEach(item => {
                                        this.getModelFactory().create('Attachment', (attachment) => {
                                            attachment.set(item);

                                            this.setAttachment(attachment);
                                        });
                                    });
                                });
                        });
                    });
                });
            }
        },

        fetch: function () {
            var data = {};

            data[this.idName] = this.model.get(this.idName);

            return data;
        },
    });
});
