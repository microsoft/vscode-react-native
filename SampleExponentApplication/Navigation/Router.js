/**
 * @providesModule Router
 */

import { createRouter } from '@exponent/ex-navigation';

export default createRouter(() => ({
  home: () => require('ConfigScreen').default,
  links: () => require('LinksScreen').default,
  tabNavigationLayout: () => require('TabNavigationLayout').default,
}));
