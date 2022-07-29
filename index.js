/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

import merge from 'deepmerge';
import osjs from 'osjs';
import {h, app} from 'hyperapp';
import {name as applicationName} from './metadata.json';
import {
  Box,
  BoxContainer,
  Button,
  Toolbar,
  TextField,
  SelectField,
  Tabs
} from '@osjs/gui';

// Maps our section items to a field
const fieldMap = () => {
  const getValue = props => props.transformValue
    ? props.transformValue(props.value)
    : props.value;

  return {
    select: props => (state, actions) => h(SelectField, {
      value: getValue(props),
      choices: props.choices(state),
      oninput: (ev, value) => actions.update({path: props.path, value})
    }),

    dialog: props => (state, actions) => h(BoxContainer, {}, [
      h(TextField, {
        box: {grow: 1},
        readonly: true,
        value: getValue(props),
        oninput: (ev, value) => actions.update({path: props.path, value})
      }),

      h(Button, {
        onclick: () => actions.dialog(props.dialog(props, state, actions, getValue(props)))
      }, '...')
    ]),

    fallback: props => (state, actions) => h(TextField, {
      value: getValue(props),
      oninput: (ev, value) => actions.update({path: props.path, value})
    })
  };
};

// Resolves a tree by dot notation
const resolve = (tree, key, defaultValue) => {
  try {
    const value = key.split(/\./g)
      .reduce((result, key) => result[key], Object.assign({}, tree));

    return typeof value === 'undefined' ? defaultValue : value;
  } catch (e) {
    return defaultValue;
  }
};

// Resolves settings by dot notation and gets default values
const resolveSetting = (settings, defaults) => key =>
  resolve(settings, key, resolve(defaults, key));

const resolveValue = (key, value) => key === 'desktop.iconview.enabled' // FIXME
  ? value === 'true'
  : value;

// Resolves a new value in our tree
// FIXME: There must be a better way
const resolveNewSetting = state => (key, value) => {
  const object = {};
  const keys = key.split(/\./g);

  let previous = object;
  for (let i = 0; i < keys.length; i++) {
    const j = keys[i];
    const last = i >= keys.length - 1;

    previous[j] = last ? resolveValue(key, value) : {};
    previous = previous[j];
  }

  const settings = merge(state.settings, object);
  return {settings};
};

// Our sections
// TODO: Translate
const tabSections = [{
  title: 'Background',
  items: [{
    label: 'Image',
    path: 'desktop.background.src',
    type: 'dialog',
    transformValue: value => value
      ? (typeof value === 'string' ? value : value.path)
      : value,
    dialog: (props, state, actions, currentValue) => ([
      'file',
      {
        // path: //TODO
        type: 'open',
        title: 'Select background',
        mime: [/^image/]
      },
      (btn, value) => {
        if (btn === 'ok') {
          actions.update({path: props.path, value});
        }
      }
    ])
  }, {
    label: 'Style',
    path: 'desktop.background.style',
    type: 'select',
    choices: () => ({
      color: 'Color',
      cover: 'Cover',
      contain: 'Contain',
      repeat: 'Repeat'
    })
  }, {
    label: 'Color',
    path: 'desktop.background.color',
    type: 'dialog',
    dialog: (props, state, actions, currentValue) => ([
      'color',
      {color: currentValue},
      (btn, value) => {
        if (btn === 'ok') {
          actions.update({path: props.path, value: value.hex});
        }
      }
    ])
  }]
}, {
  title: 'Themes',
  items: [{
    label: 'Style',
    path: 'desktop.theme',
    type: 'select',
    choices: state => state.themes.styles
  }, {
    label: 'Icons',
    path: 'desktop.icons',
    type: 'select',
    choices: state => state.themes.icons
  }, {
    label: 'Sounds',
    path: 'desktop.sounds',
    type: 'select',
    choices: state => state.themes.sounds
  }]
}, {
  title: 'Desktop',
  items: [{
    label: 'Enable desktop icons',
    path: 'desktop.iconview.enabled',
    type: 'select',
    choices: () => ([{
      label: 'Yes',
      value: 'true'
    }, {
      label: 'No',
      value: 'false'
    }])
  }, {
    label: 'Font color style',
    path: 'desktop.iconview.fontColorStyle',
    type: 'select',
    defaultValue: 'system',
    choices: () => ({
      system: 'System',
      invert: 'Inverted background color',
      custom: 'Custom color'
    })
  }, {
    label: 'Custom font color',
    path: 'desktop.iconview.fontColor',
    type: 'dialog',
    dialog: (props, state, actions, currentValue) => ([
      'color',
      {color: currentValue},
      (btn, value) => {
        if (btn === 'ok') {
          actions.update({path: props.path, value: value.hex});
        }
      }
    ])
  }]
}, {
  title: 'Locales',
  items: [{
    label: 'Language (requires restart)',
    path: 'locale.language',
    type: 'select',
    choices: state => state.locales
  }]
}];

// Renders sections
const renderSections = (core, state, actions) => {
  const resolver = resolveSetting(state.settings, state.defaults);
  const setting = path => resolver(path);
  const fields = fieldMap();

  return tabSections.map(s => {
    const items = s.items
      .map(i => {
        const item = props =>
          (fields[props.type] || fields.fallback)(props)(state, actions);

        let value = setting(i.path);
        if (typeof value === 'undefined') {
          value = i.defaultValue;
        }

        return [
          h(BoxContainer, {style: {marginBottom: 0}}, i.label),
          h(item, Object.assign({
            type: i.type,
            value
          }, i))
        ];
      });

    return h(Box, {
      grow: 1,
      shrink: 1,
      style: {
        overflow: 'auto'
      }
    }, [].concat(...items));
  });
};

// Renders our settings window
const renderWindow = (core, proc) => ($content, win) => {
  const settingsService = core.make('osjs/settings');
  const packageService = core.make('osjs/packages');
  const desktopService = core.make('osjs/desktop');
  const {translate, translatableFlat} = core.make('osjs/locale');
  const filter = type => pkg => pkg.type === type;

  const getThemes = () => {
    const get = type => packageService
      .getPackages(filter(type))
      .map(pkg => ({value: pkg.name, label: translatableFlat(pkg.title)}));

    return {
      styles: get('theme'),
      icons: get('icons'),
      sounds: [
        {value: '', label: 'None'},
        ...get('sounds')
      ]
    };
  };

  const getLocales = () => core.config('languages', {
    en_EN: 'English'
  });

  const getDefaults = () => ({
    desktop: core.config('desktop.settings', {}),
    locale: core.config('locale', {})
  });

  const getSettings = () => ({
    desktop: settingsService.get('osjs/desktop', undefined, {}),
    locale: settingsService.get('osjs/locale', undefined, {})
  });

  const setSettings = settings => settingsService
    .set('osjs/desktop', null, settings.desktop)
    .set('osjs/locale', null, settings.locale)
    .save();

  const createDialog = (...args) => core.make('osjs/dialog', ...args);

  const view = (state, actions) => h(Box, {}, [
    h(Tabs, {
      grow: 1,
      shrink: 1,
      labels: tabSections.map(s => s.title)
    }, [
      ...renderSections(core, state, actions)
    ]),

    h(BoxContainer, {}, [
      h(Toolbar, {grow: 1, shrink: 1, justify: 'flex-end'}, [
        h(Button, {
          onclick: () => actions.save()
        }, translate('LBL_SAVE'))
      ])
    ])
  ]);

  const initialState = {
    loading: false,
    locales: getLocales(),
    themes: getThemes(),
    defaults: getDefaults(),
    settings: getSettings()
  };

  const actions = {
    save: () => (state, actions) => {
      if (state.loading) {
        return;
      }

      actions.setLoading(true);

      setSettings(state.settings)
        .then(() => {
          actions.setLoading(false);
          desktopService.applySettings();
        })
        .catch(error => {
          actions.setLoading(false);
          console.error(error); // FIXME
        });
    },

    dialog: options => () => {
      const [name, args, callback] = options;

      createDialog(name, args, {
        attributes: {modal: true},
        parent: win
      }, callback);
    },

    update: ({path, value}) => state => resolveNewSetting(state)(path, value),
    refresh: () => () => ({settings: getSettings()}),
    setLoading: loading => ({loading})
  };

  const instance = app(initialState, actions, view, $content);
  const refresh = () => instance.refresh();

  win.on('settings/refresh', refresh);
};

// Creates our application
const register = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {args, options, metadata});

  const win = proc.createWindow({
    id: 'SettingsMainWindow',
    title: metadata.title.en_EN,
    dimension: {width: 400, height: 400},
    gravity: 'center'
  });

  const onSettingsSave = () => win.emit('settings/refresh');

  core.on('osjs/settings:save', onSettingsSave);

  win.on('destroy', () => {
    core.off('osjs/settings:save', onSettingsSave);
    proc.destroy();
  });

  win.render(renderWindow(core, proc));

  return proc;
};

// Register package in OS.js
osjs.register(applicationName, register);
