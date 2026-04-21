import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { requestAPI } from './request';

/**
 * Initialization data for the GdDS extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'GdDS:plugin',
  description: 'AI Tutor for supporting in JupyterLab.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension GdDS is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('GdDS settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for GdDS.', reason);
        });
    }

    requestAPI<any>('hello', app.serviceManager.serverSettings)
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The GdDS server extension appears to be missing.\n${reason}`
        );
      });
  }
};
export default plugin;
