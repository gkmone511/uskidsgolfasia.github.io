var extensions = {};

extensions['ACS.BadgesFixPLP.1.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/ACS/BadgesFixPLP/1.0.0/' + asset;
};


define('ACS.BadgesFixPLP.BadgesFix', [
    'require',
    'underscore'
], function BadgesFix(
    require,
    _
    ) {
    'use strict';

    return {
        mountToApp: function mountToApp() {
            var itemBadge;
            var ItemBadgesView;
            try {
                ItemBadgesView = require('SuiteCommerce.ItemBadges.View');
                itemBadge = require('SuiteCommerce.ItemBadges.ProductList');
                _.extend(itemBadge, {
                    addProductListChildViews: function addProductListChildViews(plp, collection) {
                        plp.addChildViews(
                            plp.PLP_VIEW, {
                                'StockDescription': {
                                    'Itembadges.View': {
                                        childViewIndex: 5,
                                        childViewConstructor: function childViewConstructor() {
                                            return new ItemBadgesView({
                                                view: 'plp',
                                                collection: collection
                                            });
                                        }
                                    }
                                }
                            }
                    );
                    }
                });
            } catch (e) {
                console.log('ERROR ON PLP BADGES');
            }
        }
    };
});


};

extensions['SuiteCommerce.ItemBadges.1.1.3'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/SuiteCommerce/ItemBadges/1.1.3/' + asset;
};

define('SuiteCommerce.ItemBadges.Configuration', [], function Configuration() {
  'use strict';

  return {
    environment: null,
    initialize: function initialize(application)
    {
      this.environment = application.getComponent('Environment');
    },

    get: function get(name) {
      if (this.environment) {
        return this.environment.getConfig(name);
      }
      return null;
    }
  }
});



define('SuiteCommerce.ItemBadges.Instrumentation.FallbackLogger', [
  'Url',
  'jQuery'
], function define(
  Url,
  $
) {
  'use strict';

  var instance = null;
  var environment = null;


  function FallbackLogger() {
    var queueErrorTemp = [];
    var queueInfoTemp = [];
    var QUEUE_NAME_SUFFIX = '-ItemBadges';
    var QUEUE_ERROR_NAME = 'queueError' + QUEUE_NAME_SUFFIX;
    var QUEUE_INFO_NAME = 'queueInfo' + QUEUE_NAME_SUFFIX;
    var isWaiting = false;

    var self = this;

    if (this instanceof FallbackLogger) {
      throw new Error('Is not possible to create a new Logger. Please use getLogger method instead.');
    }

    this.isEnabled = function isEnabled() {
      return environment && !environment.isPageGenerator();
    };

    function clearQueues() {
      localStorage.setItem(QUEUE_ERROR_NAME, JSON.stringify(queueErrorTemp));
      localStorage.setItem(QUEUE_INFO_NAME, JSON.stringify(queueInfoTemp));
      queueErrorTemp.length = 0;
      queueInfoTemp.length = 0;
      isWaiting = false;
    }

    function appendTemp() {
      var queueError = localStorage.getItem(QUEUE_ERROR_NAME);
      var queueInfo = localStorage.getItem(QUEUE_INFO_NAME);
      if (queueErrorTemp.length > 0) {
        queueError = queueError == null ? [] : JSON.parse(queueError);
        localStorage.setItem(QUEUE_ERROR_NAME, JSON.stringify(queueError.concat(queueErrorTemp)));
      }
      if (queueInfoTemp.length > 0) {
        queueInfo = queueInfo == null ? [] : JSON.parse(queueInfo);
        localStorage.setItem(QUEUE_INFO_NAME, JSON.stringify(queueInfo.concat(queueInfoTemp)));
      }
      isWaiting = false;
    }

    function sendDataThroughUserAgent(url, data) {
      var successfullyTransfer = navigator.sendBeacon(url, JSON.stringify(data));
      if (successfullyTransfer) clearQueues();
      else appendTemp();
    }

    function sendDataThroughAjaxRequest(url, data, isAsync) {
      $.ajax({
        type: 'POST',
        url: url,
        data: JSON.stringify(data),
        async: isAsync
      }).success(clearQueues)
        .fail(appendTemp);
    }

    // eslint-disable-next-line complexity
    function processQueues(isAsync) {
      if (!self.isEnabled()) {
        return;
      }
      var data;
      var parsedURL = new Url().parse(SC.ENVIRONMENT.baseUrl);
      var product = SC.ENVIRONMENT.BuildTimeInf.product;
      var URL = parsedURL.schema + '://'
        + parsedURL.netLoc + '/app/site/hosting/scriptlet.nl?script=customscript_'
        + product.toLowerCase() + '_loggerendpoint&deploy=customdeploy_'
        + product.toLowerCase() + '_loggerendpoint';

      var queueError = JSON.parse(localStorage.getItem(QUEUE_ERROR_NAME));
      var queueInfo = JSON.parse(localStorage.getItem(QUEUE_INFO_NAME));

      if ((queueInfo && queueInfo.length > 0) || (queueError && queueError.length > 0)) {
        isWaiting = true;
        data = { type: product, info: queueInfo, error: queueError };
        if (navigator.sendBeacon) {
          sendDataThroughUserAgent(URL, data);
        } else {
          sendDataThroughAjaxRequest(URL, data, isAsync);
        }
      }
    }


    this.info = function info(obj) {
      var objWrapper = obj;
      var queueInfo;
      if (!this.isEnabled()) {
        return;
      }
      objWrapper.suiteScriptAppVersion = SC.ENVIRONMENT.RELEASE_METADATA.version;
      objWrapper.message = 'clientSideLogDateTime: ' + (new Date()).toISOString();
      if (isWaiting) {
        queueInfoTemp.push(objWrapper);
      } else {
        queueInfo = JSON.parse(localStorage.getItem(QUEUE_INFO_NAME)) || [];
        queueInfo.push(objWrapper);
        localStorage.setItem(QUEUE_INFO_NAME, JSON.stringify(queueInfo));
      }
    };

    this.error = function error(obj) {
      var queueError;
      var objWrapper = obj;
      if (!this.isEnabled()) {
        return;
      }
      objWrapper.suiteScriptAppVersion = SC.ENVIRONMENT.RELEASE_METADATA.version;
      objWrapper.message = 'clientSideLogDateTime: ' + (new Date()).toISOString();
      if (isWaiting) {
        queueErrorTemp.push(objWrapper);
      } else {
        queueError = JSON.parse(localStorage.getItem(QUEUE_ERROR_NAME)) || [];
        queueError.push(objWrapper);
        localStorage.setItem(QUEUE_ERROR_NAME, JSON.stringify(queueError));
      }
    };
    if (!this.isEnabled()) {
      return this;
    }
    setInterval(function setInterval() {
      processQueues(true);
    }, 60000);

    window.addEventListener('beforeunload', function addListener() {
      processQueues(false);
    });

    return this;
  }

  FallbackLogger.getLogger = function getLogger(localEnvironment) {
    environment=localEnvironment;
    instance = instance || FallbackLogger.apply({});
    return instance;
  };

  return FallbackLogger;
});


define(
  'SuiteCommerce.ItemBadges.Instrumentation.MockAppender', [],
  function define() {
    'use strict';

    return  {
     info : function info(data) {
        console.info('MockAppender - Info', data);
      },

      error : function error(data) {
        console.error('MockAppender - Error', data);
      },

      ready : function ready() {
        return true;
      },

      getInstance : function getInstance() {
        if (!this.instance) {
          this.instance = this;
        }
        return this.instance;
      },

      start : function start(action, options) {
        return options;
      },

      end : function end(startOptions, options) {}
    };

  });


define(
  'SuiteCommerce.ItemBadges.Instrumentation.Collection',
  [
    'SuiteCommerce.ItemBadges.Instrumentation.Model',
    'underscore',
    'Backbone'
  ],
  function define(
    model,
    _,
    Backbone
  ) {
    'use strict';

    return Backbone.Collection.extend({
      model: model
    });
  }
);


define(
  'SuiteCommerce.ItemBadges.Instrumentation.Model',
  [
    'SuiteCommerce.ItemBadges.Instrumentation.Logger',
    'Backbone',
    'underscore'
  ],
  function define(
    Logger,
    Backbone,
    _
  ) {
    'use strict';

    var DEFAULT_SEVERITY = 'info';

    return Backbone.Model.extend({
      defaults: function defaults() {
        return {
          parametersToSubmit: {},
          timer: {},
          severity: DEFAULT_SEVERITY
        };
      },

      startTimer: function startTimer() {
        var startTime = this.getTimestamp();
        var timer = this.get('timer');
        timer.startTime = startTime;
        this.set('timer', timer);
      },

      endTimer: function endTimer() {
        var endTime = this.getTimestamp();
        var timer = this.get('timer');
        timer.endTime = endTime;
        this.set('timer', timer);
      },

      getTimestamp: function getTimestamp() {
        if (!this.isOldInternetExplorer()) {
          return performance.now() || Date.now();
        }
        return Date.now();
      },

      getElapsedTimeForTimer: function getElapsedTimeForTimer() {
        var timer = this.get('timer');
        if (timer.startTime && timer.endTime) {
          if (timer.startTime > timer.endTime) {
            console.warn('Start time should be minor that end time in timer');
            return null;
          }
          return timer.endTime - timer.startTime;
        }
        if (!timer.startTime) console.warn('The Start time is not defined');
        if (!timer.endTime) console.warn('The End time is not defined');
        return null;
      },

      setParametersToSubmit: function setParametersToSubmit(data) {
        var self = this;
        _.each(data, function setLogParameter(value, parameter) {
          self.setParameterToSubmit(parameter, data[parameter]);
        });
      },

      setParameterToSubmit: function setParameterToSubmit(parameter, value) {
        var logData = this.get('parametersToSubmit');
        logData[parameter] = value;
        this.set('parametersToSubmit', logData);
      },

      setSeverity: function setSeverity(severity) {
        this.set('severity', severity);
      },

      submit: function submit() {
        if (!this.isOldInternetExplorer()) {
          switch (this.get('severity')) {
            case 'error':
              this.submitAsError();
              break;
            default:
              this.submitAsInfo();
          }
        }
      },

      isOldInternetExplorer: function isOldInternetExplorer() {
        return !!navigator.userAgent.match(/Trident/g) || !!navigator.userAgent.match(/MSIE/g);
      },

      submitAsError: function submitAsError() {
        Logger.getLogger().error(this.get('parametersToSubmit'));
      },

      submitAsInfo: function submitAsInfo() {
        Logger.getLogger().info(this.get('parametersToSubmit'));
      }
    });
  }
);


define(
  'SuiteCommerce.ItemBadges.Instrumentation.InstrumentationHelper',
  [
    'SuiteCommerce.ItemBadges.Instrumentation.Model',
    'SuiteCommerce.ItemBadges.Instrumentation.Collection',
    'SuiteCommerce.ItemBadges.Instrumentation.Logger'
  ],
  function define(
    Log,
    LogCollection,
    Logger
  ) {
    'use strict';

    var logs = new LogCollection();

    return {
      logs: logs,

      initialize: function initialize(container) {
        Logger.initialize(container.getComponent('Environment'));
      },

      getLog: function getLog(logLabel) {
        return this.getLogModelByLabel(logLabel) || this.registerNewLog(logLabel);
      },

      getLogModelByLabel: function getLogModelByLabel(label) {
        return this.logs.findWhere({
          label: label
        });
      },

      registerNewLog: function registerNewLog(label) {
        var log = new Log();
        log.set('label', label);
        this.logs.add(log);
        return log;
      },

      setParameterToSubmitForAllLogs: function setParameterToSubmitForAllLogs(parameter, value) {
        this.logs.each(function updateLog(log) {
          log.setParameterToSubmit(parameter, value);
        });
      },

      setParametersToSubmitForAllLogs: function setParametersToSubmitForAllLogs(data) {
        this.logs.each(function updateLog(log) {
          log.setParametersToSubmit(data);
        });
      },

      submitAllLogs: function submitAllLogs() {
        this.logs.each(function submitLog(log) {
          log.submit();
        });
      }
    };
  }
);


define(
  'SuiteCommerce.ItemBadges.Instrumentation.Logger',
  [
    'SuiteCommerce.ItemBadges.Instrumentation.FallbackLogger',
    'SuiteCommerce.ItemBadges.Instrumentation.MockAppender'
  ], function define(
    InstrumentationFallbackLogger,
    InstrumentationMockAppender
  ) {
    'use strict';

    var environment = null;
    var instance = null;
    var QUEUE_NAME_SUFFIX = '-ItemBadges';

    return {

      initialize: function initialize(localEnvironment) {
        environment = localEnvironment;
      },

      getLogger: function getLogger() {
        instance = instance || this.buildLoggerInstance();
        return instance;
      },

      buildLoggerInstance: function buildLoggerInstance() {
        var logConfig = {};
        try {
          var LoggersModule = require('Loggers').Loggers;
          var elasticAppender = require('Loggers.Appender.ElasticLogger')
            .LoggersAppenderElasticLogger.getInstance();
          var mockAppender = InstrumentationMockAppender.getInstance();
          var configurationModule = require('Loggers.Configuration');
          var loggerName = 'CommerceExtensions' + QUEUE_NAME_SUFFIX;
          logConfig[loggerName] = {
            log: [
              { profile: configurationModule.prod, appenders: [elasticAppender] },
              { profile: configurationModule.dev, appenders: [mockAppender] },
            ],
            actions: {},
            loggers: {},
          };
          LoggersModule.setConfiguration(logConfig);
          return LoggersModule.getLogger(loggerName);
        } catch (e) {
          return InstrumentationFallbackLogger.getLogger(environment);
        }
      },
    };
  });



define('SuiteCommerce.ItemBadges.BadgesList.View', [
  'Backbone',

  'itembadges_list.tpl',

  'itembadges_svg_bookmark.tpl',
  'itembadges_svg_diagonal_banner.tpl',
  'itembadges_svg_flag.tpl',
  'itembadges_svg_rectangle_banner.tpl',
  'itembadges_svg_tag.tpl',
  'itembadges_svg_tapered_banner.tpl'
], function ItemBadgesBadgesListView(
  Backbone,

  itembadgesListTpl,

  bookmark,
  diagonalBanner,
  flag,
  rectangleBanner,
  tag,
  taperedBanner
) {
  'use strict';

  return Backbone.View.extend({
    template: itembadgesListTpl,

    initialize: function initialize(options) {
      this.model = options.model;
      this.position = options.position;
      this.currentView = options.currentView;
    },

    calculateWeight: function calculateWeight() {
      var weight = this.model.get('weight');
      switch (weight) {
        case '1':
          this.model.set('textWeight', '300');
          break;
        case '2':
          this.model.set('textWeight', '400');
          break;
        case '3':
          this.model.set('textWeight', '600');
          break;
        case '4':
          this.model.set('textWeight', '700');
          break;
        default:
          this.model.set('textWeight', '400');
      }
    },

    selectTemplate: function selectTemplate() {
      var modifier = this.model.get('text').length * 8;
      var padding = this.currentView === 'plp' ? 5 : 10;
      var totalPadding = padding * 2;
      switch (this.model.get('shape').shape) {
        case 'Bookmark':
          this.defineBookmark(totalPadding, modifier);
          break;
        case 'Diagonal Banner':
          this.defineDiangonalBanner();
          break;
        case 'Flag':
          this.defineFlag(totalPadding, modifier);
          break;
        case 'Rectangle Banner':
          this.defineRectangleBanner(totalPadding, modifier);
          break;
        case 'Tag':
          this.defineTag(totalPadding, modifier);
          break;
        case 'Tapered Banner':
          this.defineTaperedBanner(totalPadding, modifier);
          break;
        default:
          if (!this.model.get('shape').image) {
            this.defineRectangleBanner(totalPadding, modifier);
          }
      }
    },

    defineBookmark: function defineBookmark(totalPadding, modifier) {
      var textSpace = totalPadding + modifier;
      var shape = this.calculateBookmarkShape(textSpace);
      this.model.set('svg',
        {
          width: textSpace + 34.5,
          shape: shape,
          textEnd: this.currentView === 'plp' ? textSpace : textSpace - 10,
          textStart: this.currentView === 'plp' ? 30 : 40,
          height: this.currentView === 'plp' ? 54 : 64
        });
      this.template = bookmark;
    },

    calculateBookmarkShape: function calculateBookmarkShape(textSpace) {
      var plpModifier = this.currentView === 'plp' ? 10 : 0;
      if (this.position.match('right')) {
        return 'M' + (textSpace + 1 + plpModifier) + ',0 L' + (textSpace + 1 + plpModifier) + ','+(62-plpModifier)+' L' + (textSpace + 18 + (plpModifier/2)) + ','+(55-plpModifier)+' L' + (textSpace + 35.5) + ','+(62-plpModifier)+' L' + (textSpace + 35.5) + ',0 L' + (textSpace + 79) + ',0 Z';
      }
      return 'M1,0 L1,'+(62-plpModifier)+' L'+(18-(plpModifier/2))+','+(55-plpModifier)+' L'+(35.5-(plpModifier))+','+(62-plpModifier)+' L'+(35.5-(plpModifier))+',0 L79,0 Z';
    },

    defineDiangonalBanner: function defineDiangonalBanner() {
      this.model.set('svg',
        {
          textCenter: this.currentView === 'plp' ? 18 : 23,
          height: this.currentView === 'plp' ? 25 : 35
        });
      this.template = diagonalBanner;
    },

    defineFlag: function defineFlag(totalPadding, modifier) {
      var additionalPixels = 7.5;
      var totalPixels = totalPadding + additionalPixels;
      var width = totalPixels + modifier;
      var textMiddle = this.calculateTextMiddle(totalPadding, modifier, additionalPixels);
      var textHeight = this.currentView === 'plp' ? 16.75 : 21.75;
      this.model.set('svg',
        {
          shape: 'M0,0 L' + (totalPixels + modifier) + ',0 L' + (totalPadding + modifier) + ','+(7.5+(totalPadding/2))+' L' + (totalPixels + modifier) + ','+(15+totalPadding)+' L0,'+(15+totalPadding)+' Z',
          width: width,
          textMiddle: textMiddle,
          textHeight: textHeight,
          height: totalPadding + 15
        });
      this.template = flag;
    },

    defineRectangleBanner: function defineRectangleBanner(totalPadding, modifier) {
      var width = totalPadding + modifier;
      var textMiddle = this.calculateTextMiddle(totalPadding, modifier);
      var textHeight = this.currentView === 'plp' ? 16.75 : 21.75;
      this.model.set('svg',
        {
          width: width,
          textMiddle: textMiddle,
          textHeight: textHeight,
          height: totalPadding + 15
        });
      this.template = rectangleBanner;
    },

    defineTag: function defineTag(totalPadding, modifier) {
      var additionalPixels = 14;
      var totalPixels = totalPadding + additionalPixels;
      var width = totalPixels + modifier;
      var textMiddle = this.calculateTextMiddle(totalPadding, modifier, additionalPixels);
      var textHeight = this.currentView === 'plp' ? 16.75 : 21.75;
      this.model.set('svg',
        {
          shape: 'M' + (totalPadding + modifier) + ',0 L' + (totalPixels + modifier) + ','+(7.5+(totalPadding/2))+' L' + (totalPadding + modifier) + ','+(15+totalPadding)+' L0,'+(15+totalPadding)+' L0,0 L' + (totalPadding + modifier) + ',0 Z',
          width: width,
          textMiddle: textMiddle,
          textHeight: textHeight,
          height: totalPadding + 15
        });
      this.template = tag;
    },

    defineTaperedBanner: function defineTaperedBanner(totalPadding, modifier) {
      var additionalPixels = 13;
      var totalPixels = totalPadding + additionalPixels;
      var width = totalPixels + modifier;
      var textMiddle = this.calculateTextMiddle(totalPadding, modifier, additionalPixels);
      var textHeight = this.currentView === 'plp' ? 16.75 : 21.75;
      this.model.set('svg',
        {
          shape: 'M0,0 L' + (totalPixels + modifier) + ',0 L' + (totalPadding + modifier) + ','+(15+totalPadding)+' L0,'+(15+totalPadding)+' Z',
          width: width,
          textMiddle: textMiddle,
          textHeight: textHeight,
          height: totalPadding + 15
        });
      this.template = taperedBanner;
    },

    calculateTextMiddle: function calculateTextMiddle(totalPadding, modifier, additionalPixels) {
      if (this.position.match('right') && additionalPixels) {
        return additionalPixels + ((totalPadding + modifier) / 2);
      }
      return (totalPadding + modifier) / 2;
    },

    flipVertical: function flipVertical() {
      return !!this.position.match('right');
    },

    getContext: function getContext() {
      var showText = !!this.model.get('text');
      var showImage = !!this.model.get('shape').image;
      this.selectTemplate();
      this.calculateWeight();
      return {
        model: this.model,
        name: this.model.get('name'),
        alt: this.model.get('alt'),
        showText: showText,
        text: this.model.get('text'),
        textColor: this.model.get('color') || '#FFFFFF',
        textBgColor: this.model.get('background'),
        textWeight: this.model.get('textWeight'),
        showImage: showImage,
        shapeId: this.model.get('shape').id,
        shapeName: this.model.get('shape').name,
        shapeImage: this.model.get('shape').image,
        areBothElementsVisibile: showText && showImage,
        svg: this.model.get('svg'),
        position: this.position,
        flipVertical: this.flipVertical(),
        isPlp: this.currentView === 'plp'
      };
    }
  });
});


define('SuiteCommerce.ItemBadges.Collection', [
  'Backbone',
  'Backbone.CachedCollection',
  'SuiteCommerce.ItemBadges.Model',
  'underscore'
], function ItemBadgesCollection(
  Backbone,
  BackboneCachedCollection,
  Model,
  _
) {
  'use strict';

  return BackboneCachedCollection.extend({
    model: Model,

    url: '/app/site/hosting/scriptlet.nl?script=customscript_ns_sc_sl_itembadges&deploy=customdeploy_ns_sc_sl_itembadges',

    filterBadges: function filterBadges(badges) {
      var self = this;
      var itemBadges;
      var data;

      if (badges) {
        itemBadges = badges.split(',');
        _.each(itemBadges, function each(value, key) {
          itemBadges[key] = value.trim();
        });

        data = _.filter(self.models, function filter(badge) {
          return _.contains(itemBadges, badge.get('name').trim());
        });
      }

      return new Backbone.Collection(data);
    }
  });
});


define('SuiteCommerce.ItemBadges.GlobalViews', [
  'SuiteCommerce.ItemBadges.View'
], function ItemBadgesGlobalViews(
  ItemBadgesView
) {
  'use strict';

  return {
    loadGlobalViewsItemBadges: function loadGlobalViewsItemBadges(application, collection) {
      var layout = application.getComponent('Layout');
      this.addGlobalViewsChildViews(layout, collection);
    },

    addGlobalViewsChildViews: function addGlobalViewsChildViews(layout, collection) {
      layout.addChildViews(
        'ItemRelations.RelatedItem.View', {
          'Item.Price': {
            'Itembadges.View': {
              childViewIndex: 5,
              childViewConstructor: function childViewConstructor() {
                return new ItemBadgesView({
                  view: 'global',
                  collection: collection
                });
              }
            }
          }
        }
      );
    }
  };
});


define('SuiteCommerce.ItemBadges.Model', [
  'Backbone.CachedModel'
], function ItemBadgesModel(
  CachedModel
) {
  'use strict';

  return CachedModel.extend({

  });
});


define('SuiteCommerce.ItemBadges.ProductDetail', [
  'SuiteCommerce.ItemBadges.View'
], function ItemBadgesProductDetail(
  ItemBadgesView
) {
  'use strict';

  return {
    loadProductDetailItemBadges: function loadProductDetailItemBadges(application, collection) {
      var pdp = application.getComponent('PDP');
      this.addProductDetailChildViews(pdp, collection);
    },

    addProductDetailChildViews: function addProductDetailChildViews(pdp, collection) {
      pdp.addChildViews(
        pdp.PDP_FULL_VIEW, {
          'Product.ImageGallery': {
            'Itembadges.View': {
              childViewIndex: 5,
              childViewConstructor: function childViewConstructor() {
                return new ItemBadgesView({
                  view: 'pdp',
                  items: pdp.getItemInfo(),
                  collection: collection
                });
              }
            }
          }
        }
      );

      pdp.addChildViews(
        pdp.PDP_QUICK_VIEW, {
          'Product.ImageGallery': {
            'Itembadges.View': {
              childViewIndex: 5,
              childViewConstructor: function childViewConstructor() {
                return new ItemBadgesView({
                  view: 'pdp',
                  items: pdp.getItemInfo(),
                  collection: collection
                });
              }
            }
          }
        }
      );
    }
  };
});


define('SuiteCommerce.ItemBadges.ProductList', [
  'SuiteCommerce.ItemBadges.View'
], function ItemBadgesProductList(
  ItemBadgesView
) {
  'use strict';

  return {
    loadProductListItemBadges: function loadPDPItemBadges(application, collection) {
      var plp = application.getComponent('PLP');
      this.addProductListChildViews(plp, collection);
    },

    addProductListChildViews: function addProductListChildViews(plp, collection) {
      plp.addChildViews(
        plp.PLP_VIEW, {
          'ItemDetails.Options': {
            'Itembadges.View': {
              childViewIndex: 5,
              childViewConstructor: function childViewConstructor() {
                return new ItemBadgesView({
                  view: 'plp',
                  collection: collection
                });
              }
            }
          }
        }
      );
    }
  };
});


define('SuiteCommerce.ItemBadges.View', [
  'Backbone',
  'Backbone.CollectionView',
  'SuiteCommerce.ItemBadges.BadgesList.View',
  'SuiteCommerce.ItemBadges.Configuration',
  'underscore',
  'itembadges_view.tpl',
  'SuiteCommerce.ItemBadges.Instrumentation.InstrumentationHelper'
], function ItemBadgesView(
  Backbone,
  BackboneCollectionView,
  ItemBadgesbadgesListView,
  Configuration,
  _,
  itembadgesViewTpl,
  InstrumentationHelper
) {
  'use strict';

  return Backbone.View.extend({
    template: itembadgesViewTpl,

    contextDataRequest: ['item'],

    initialize: function initialize(options) {
      var self = this;

      this.items = options.items;
      this.collection = options.collection;
      this.currentView = options.view;
      this.position = Configuration.get('itemBadges').position.toLowerCase().replace(/\s/, '-');

      _.defer(function deferedRender() {
        self.registerInstrumentationLog();
        self.render();
      });
    },

    registerInstrumentationLog: function registerInstrumentationLog() {
      var instrumentationLog;
      var activity;
      if (this.badgeCollection.length) {
        switch (this.currentView) {
          case 'pdp':
            activity = 'Item badges loaded on PDP';
            break;
          case 'plp':
            activity = 'Item badges loaded on PLP';
            break;
          default:
        }
        instrumentationLog = InstrumentationHelper.getLog('instrumentationLog');
        instrumentationLog.setParametersToSubmit({
          componentArea: 'SC Item Badges',
          activity: activity,
          quantity: this.badgeCollection.length
        });
        instrumentationLog.submit();
      }
    },

    getContext: function getContext() {
      var itemBadges;
      var item;
      var showBadges;

      switch (this.currentView) {
        case 'pdp':
          showBadges = this.items.item.custitem_ns_ib_show_badges;
          itemBadges = this.items.item.custitem_ns_ib_badges;
          break;
        default:
          item = this.contextData.item();
          showBadges = item.custitem_ns_ib_show_badges;
          itemBadges = item.custitem_ns_ib_badges;
      }

      if (itemBadges && itemBadges.split(',').length >= 3) {
        itemBadges = itemBadges.split(',').slice(0, 3) + '';
      }

      this.badgeCollection = this.collection.filterBadges(itemBadges || false);

      return {
        hasBadges: showBadges && !!this.badgeCollection,
        position: this.position
      };
    },

    childViews: {
      'Itembadges.List.View': function ItembadgesListView() {
        return new BackboneCollectionView({
          collection: this.badgeCollection,
          childView: ItemBadgesbadgesListView,
          childViewOptions: {
            currentView: this.currentView,
            position: this.position
          }
        });
      }
    }
  });
});


define('SuiteCommerce.ItemBadges.EntryPoint', [
  'SuiteCommerce.ItemBadges.Collection',
  'SuiteCommerce.ItemBadges.ProductDetail',
  'SuiteCommerce.ItemBadges.ProductList',
  'SuiteCommerce.ItemBadges.GlobalViews',
  'SuiteCommerce.ItemBadges.Instrumentation.InstrumentationHelper',
  'SuiteCommerce.ItemBadges.Configuration'
], function ItemBadgesEntryPoint(
  ItemBadgesCollection,
  ItemBadgesProductDetail,
  ItemBadgesProductList,
  ItemBadgesGlobalViews,
  InstrumentationHelper,
  Configuration
) {
  'use strict';

  return {
    mountToApp: function mountToApp(application) {
      var log = InstrumentationHelper.initialize(application);
      Configuration.initialize(application);
      var collection = new ItemBadgesCollection();
      var collectionPromise;
      ItemBadgesProductDetail.loadProductDetailItemBadges(application, collection);
      ItemBadgesProductList.loadProductListItemBadges(application, collection);
      ItemBadgesGlobalViews.loadGlobalViewsItemBadges(application, collection);
      collectionPromise = collection.fetch();
      this.registerFetchTimer(collectionPromise);
    },

    registerFetchTimer: function registerFetchTimer(collectionPromise) {
      var fetchTimer = InstrumentationHelper.getLog('fetchTimer');
      fetchTimer.startTimer();
      collectionPromise.done(function promiseDone() {
        fetchTimer.endTimer();
        fetchTimer.setParametersToSubmit({
          componentArea: 'SC Item Badges',
          activity: 'Fetch Timer',
          totalTime: fetchTimer.getElapsedTimeForTimer()
        });
        fetchTimer.submit();
      });
    }
  };
});


};

extensions['ACS.B2CEmbroideryValidation.4.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/ACS/B2CEmbroideryValidation/4.0.0/' + asset;
};


define('EmbroideryValidation.Main', [
    'jQuery',
    'underscore'
], function EmbroideryValidation(
    jQuery,
    _
) {
    'use strict';

    return {
        mountToApp: function mountToApp(container) {
            var cart = container.getComponent('Cart');
            cart.on('beforeAddLine', function beforeAddLine(line) {
                var logo = _.find(line.line.options, { cartOptionId: 'custcol_kd_embroidery_logo_cost' });
                var logoSelected = _.find(line.line.options, { cartOptionId: 'custcol_kd_embroidery' });
                var text = _.find(line.line.options, { cartOptionId: 'custcol_kd_embroidery_text_cost' });
                var textSelected = _.find(line.line.options, { cartOptionId: 'custcol_kd_embroidery_text' });
                var isEmbroideryOpen = jQuery('.fake-minimize.open').length > 0;
                if ((logo.value && logo.value.internalid) && !logoSelected.value) {
                    return jQuery.Deferred().reject('Please select the personalization logo.');
                }
                if ((text.value && text.value.internalid) && !textSelected.value) {
                    return jQuery.Deferred().reject('Please add the personalization text.');
                }
                if (isEmbroideryOpen && !textSelected.value && !logoSelected.value) {
                    return jQuery.Deferred().reject('You havent select your personalization');
                }
                return jQuery.Deferred().resolve();
            });
        }
    };
});


};

extensions['Kodella.KDClearCart.1.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/Kodella/KDClearCart/1.0.0/' + asset;
};

// @module Kodella.KDClearCart.KDClearCart
define("Kodella.KDClearCart.KDClearCart.View", [
  "kodella_kdclearcart_kdclearcart.tpl",

  "Kodella.KDClearCart.KDClearCart.SS2Model",

  "Backbone",
  "LiveOrder.Model",
  "GlobalViews.Confirmation.View",
], function (
  kodella_kdclearcart_kdclearcart_tpl,

  KDClearCartSS2Model,

  Backbone,
  LiveOrderModel,
  GlobalViewsConfirmationView
) {
  "use strict";

  // @class Kodella.KDClearCart.KDClearCart.View @extends Backbone.View
  return Backbone.View.extend({
    template: kodella_kdclearcart_kdclearcart_tpl,

    initialize: function (options) {},

    events: {
      'click [data-action="remove-all"]': "removeAll",
    },

    removeAll: function removeAll() {
      var removeAllLinesConfirmationView = new GlobalViewsConfirmationView({
        callBack: this._removeAll,
        title: _("Remove All Items").translate(),
        body: _("Are you sure you want to remove all items from your cart?").translate(),
        autohide: true,
      });

      return this.options.layout.showContent(removeAllLinesConfirmationView, { showInModal: true });
    },

    _removeAll: function _removeAll() {
      var model = LiveOrderModel.getInstance();

      return model.destroy().done(function (attributes) {
        model.set(attributes);
      });
    },

    //@method getContext @return Kodella.KDClearCart.KDClearCart.View.Context
    getContext: function getContext() {},
  });
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDClearCart.KDClearCart.Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({

        
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "services/KDClearCart.Service.ss"
            )
        )
        
});
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDClearCart.KDClearCart.SS2Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "Modules/KDClearCart/SuiteScript2/KDClearCart.Service.ss"
            ),
            true
        )
});
});


define("Kodella.KDClearCart.KDClearCart", ["Kodella.KDClearCart.KDClearCart.View"], function (KDClearCartView) {
  "use strict";

  return {
    mountToApp: function mountToApp(container) {
      var cart = container.getComponent("Cart");
      var layout = container.getComponent("Layout");
      if (cart) {
        layout.addChildView("Clear.Cart.View", function () {
          return new KDClearCartView({ layout: layout });
        });
        //     cart.on("afterShowContent", function () {
        //       var clearCartBtn = document.querySelector("#cart-remove-all");
        //       clearCartBtn.addEventListener("click", function () {
        //         var confirmation = confirm("Remove all items from your cart?");
        //         if (confirmation) {
        //           //   cart.getLines().then(function (lines) {
        //           //     lines.forEach(function (line) {
        //           //       cart.removeLine({
        //           //         line_id: line.internalid,
        //           //       });
        //           //     });
        //           //   });
        //         }
        //       });
        //     });
      }
    },
  };
});


};

extensions['ACS.HomeBanner.1.0.6'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/ACS/HomeBanner/1.0.6/' + asset;
};

define('HomeBanner.View', [
    'underscore'
], function HomeBannerView(
    _
) {
    'use strict';

    return {
        loadModule: function loadModule(options) {
            // for Carousel
            var environment = options.getComponent('Environment');
            var layout = options.getComponent('Layout');
            var carousel = environment.getConfig('homeCarouselCustom.themeCarouselImages', []);
            var carouselObj;
            var isReady = false;
            // var promos = Configuration.get('home.promo', []);
            // var firstPromo = promos[0];

            layout.addToViewContextDefinition(
                'Home.View',
                'extraHomeView',
                'object',
                function addToViewContextDefinition(context) {
                    carouselObj = context.carousel;
                    isReady =
                        _.has(context, 'isReady') && !_.isUndefined(context.isReady)
                            ? context.isReady
                            : true;

                    if (!_.isEmpty(carouselObj)) {
                        _.each(carouselObj, function (carousel) {
                            if (!_.isEmpty(carousel.image)) {
                                _.extend(carousel, {
                                    isAbsoluteUrl: carousel.image.indexOf('core/media') !== -1,
                                });
                            }
                        });
                    } else {
                        carouselObj = carousel;
                    }

                    return {
                        isReady: isReady,
                        showCarousel: carouselObj && !!carouselObj.length,
                        carousel: carouselObj
                    };
                }
            );
        }
    };
});


srcRequire=require
define('HomeBanner', [
    'HomeBanner.View',
    'Utils',
    'underscore'
], function HomeBanner(
    HomeBannerView,
    Utils,
    _
) {
    'use strict';

    return {
        mountToApp: function mountToApp(container) {
            this.configuration = container.getComponent('Environment');
            this.overwriteBxSliderInitialization();
            HomeBannerView.loadModule(container);
        },
        overwriteBxSliderInitialization: function overwriteBxSliderInitialization() {
            var self = this;
            Utils.initBxSlider = _.initBxSlider = _.wrap(
                _.initBxSlider,
                function initBxSlider(fn) {
                    var autoPlayCarousel = self.configuration.getConfig('homeCarouselCustom.autoPlayCarousel');
                    var carouselSpeed = self.configuration.getConfig('homeCarouselCustom.carouselSpeed');
                    if (
                        arguments.length !== 0 &&
                        arguments[1] &&
                        arguments[1][0] &&
                        arguments[1][0].id === 'home-image-slider-list'
                    ) {
                        arguments[2] = _.extend(arguments[2], {
                            auto: autoPlayCarousel,
                            pause: carouselSpeed,
                        });
                    }
                    return fn.apply(this, _.toArray(arguments).slice(1));
                }
            );
        }
    };
});


};

extensions['Kodella.KDGlobalExtension.1.1.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/Kodella/KDGlobalExtension/1.1.0/' + asset;
};

// @module Kodella.KDGlobalExtension.KDGlobalExtension
define("Kodella.KDGlobalExtension.KDGlobalExtension.View", [
  "kodella_kdglobalextension_kdglobalextension.tpl",

  "Kodella.KDGlobalExtension.KDGlobalExtension.SS2Model",

  "Backbone",
], function (
  kodella_kdglobalextension_kdglobalextension_tpl,

  KDGlobalExtensionSS2Model,

  Backbone
) {
  "use strict";

  // @class Kodella.KDGlobalExtension.KDGlobalExtension.View @extends Backbone.View
  return Backbone.View.extend({
    template: kodella_kdglobalextension_kdglobalextension_tpl,

    initialize: function (options) {
      /*  Uncomment to test backend communication with an example service
				(you'll need to deploy and activate the extension first)
			*/
      // this.model = new KDGlobalExtensionModel();
      // var self = this;
      // this.model.fetch().done(function(result) {
      // 	self.message = result.message;
      // 	self.render();
      // });
    },

    events: {},

    bindings: {},

    childViews: {},

    //@method getContext @return Kodella.KDGlobalExtension.KDGlobalExtension.View.Context
    getContext: function getContext() {
      //@class Kodella.KDGlobalExtension.KDGlobalExtension.View.Context
      // this.message = this.message || 'Hello World!!'
      // return {
      // 	message: this.message
      // };
    },
  });
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDGlobalExtension.KDGlobalExtension.Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({

        
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "services/KDGlobalExtension.Service.ss"
            )
        )
        
});
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDGlobalExtension.KDGlobalExtension.SS2Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "Modules/KDGlobalExtension/SuiteScript2/KDGlobalExtension.Service.ss"
            ),
            true
        )
});
});


/* eslint-disable*/
define("Kodella.KDGlobalExtension.KDGlobalExtension", [
  "Kodella.KDGlobalExtension.KDGlobalExtension.View",
  "Header.View",
  "Header.Logo.View",
  "Header.Profile.View",
  "Utils",
  "ProductViews.Option.View",
  "Footer.View",
  "SC.Configuration",
], function (
  KDGlobalExtensionView,
  HeaderView,
  HeaderLogoView,
  HeaderProfileView,
  Utils,
  PDPOptionView,
  FooterView,
  SCConfiguration
) {
  "use strict";
  function addImage(element, height) {
    var url = "/site/images/Global/Height Icons/uskids-player-height-icon-" + height + ".png";
    var img = document.createElement("img");
    img.src = url;
    element.insertAdjacentElement("afterbegin", img);
  }
  return {
    mountToApp: function mountToApp(container) {
      var pdp = container.getComponent("PDP");
      //pdp matrix options prices
      PDPOptionView.prototype.getContext = _.wrap(PDPOptionView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        if (this.parentView.parentView.model.attributes.item) {
          var allMatrixChilds = this.parentView.parentView.model.attributes.item.attributes.matrixchilditems_detail;
          var newValues = [];
          if (allMatrixChilds && context.itemOptionId === "custitem_kd_matrix_condition") {
            context.values.forEach(function (option) {
              allMatrixChilds.forEach(function (matrix) {
                if (option.label === matrix.custitem_kd_matrix_condition) {
                  var newOption = option;
                  newOption.price = matrix.onlinecustomerprice_detail.onlinecustomerprice_formatted;
                  newValues.push(newOption);
                }
              });
            });
            context.values = newValues;
          }
        }

        return context;
      });
      //Header Menu neccesary code
      //Mobile or desktop
      HeaderView.prototype.getContext = _.wrap(HeaderView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        var isMobile = Utils.getViewportWidth() < 992;
        var isDesktop = Utils.getViewportWidth() > 992;
        context.isDesktop = isDesktop;
        context.isMobile = isMobile;
        return context;
      });
      HeaderLogoView.prototype.getContext = _.wrap(HeaderLogoView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        var isMobile = Utils.getViewportWidth() < 992;
        var isDesktop = Utils.getViewportWidth() > 992;
        context.isDesktop = isDesktop;
        context.isMobile = isMobile;
        return context;
      });
      HeaderProfileView.prototype.getContext = _.wrap(HeaderProfileView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        var isMobile = Utils.getViewportWidth() < 992;
        var isDesktop = Utils.getViewportWidth() > 992;
        context.isDesktop = isDesktop;
        context.isMobile = isMobile;
        return context;
      });
      FooterView.prototype.getContext = _.wrap(FooterView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        context.links = SCConfiguration.KDGlobalExtension;
        return context;
      });
      var layout = container.getComponent("Layout");
      var environmentComponent = container.getComponent("Environment");

      layout.on("afterShowContent", function () {
        //Quick search code
        setTimeout(function (){
          var quickSearch = document.querySelector(".quick-search-main-container");
          if (quickSearch) {
            var absoluteUrl = Utils.getAbsoluteUrl();
            var indexToSlice = absoluteUrl.indexOf("/sca");
            absoluteUrl = absoluteUrl.slice(0, indexToSlice) + "/";

            // var finalUrl =
            //   absoluteUrl +
            //   "api/items?c=5916842&country=US&currency=USD&fieldset=search&include=facets&language=en&limit=24&n=2&offset=0&pricelevel=5&sort=relevance%3Adesc&use_pcv=F";
            // Get the currency dynamically in the site settings
            var siteCurrency = environmentComponent.getSiteSetting("currencies")[0].code;
            var finalUrl =
              absoluteUrl +
              "api/items?c=5916842&country=US&currency="+siteCurrency+"&fieldset=search&include=facets&language=en&limit=24&n=2&offset=0&pricelevel=5&sort=relevance%3Adesc&use_pcv=F";

            //If we are in home page we fetch the facets
            jQuery.getJSON(finalUrl)
              .done(function (data) {
                loadQuickSearchOptions(data);
              });
            var categories = SC.Application("Shopping").Configuration.navigationData[4].categories[2].categories;

            var loadQuickSearchOptions = function(data) {
              var facets = data.facets;

              //selects
              var handSelect = document.querySelector(".quick-search-container #hand");
              var submiteBtn = document.querySelector("#submit-quick-search");
              var systemSelectList = document.querySelector(".quick-search-container #system-list");
              var sizeSelectList = document.querySelector(".quick-search-container #height-list");

              //Fill the Options tabs
              if (facets) {
                facets.forEach(function (facet) {
                  if (facet.id === "custitem_kd_hand") {
                    facet.values.forEach(function (value) {
                      var option = document.createElement("option");
                      option.text = value.label;
                      option.value = facet.url + "/" + value.url;
                      handSelect.add(option);
                    });
                  } else if (facet.id === "custitem_kd_size") {
                    var i = 0;
                    var imagesURL = [66, 63, 60, 57, 54, 51, 48, 45, 42, 39, 36, "baby-first-club"];
                    facet.values.forEach(function (value) {
                      // var isNum = /^\d+$/.test(value.label);
                      if (i < imagesURL.length) {
                        

                        var li = document.createElement("li");
                        var a = document.createElement("a");
                        var text = document.createElement("p");
                        var span = document.createElement("span");

                        span.innerHTML = value.label;

                        text.appendChild(span);
                        // if (value.label == 33) {
                        //   span.innerHTML = "Infant";
                        //   text.appendChild(span);
                        //   value.label = "baby-first-club";
                        // }

                        text.classList.add("dropdown-title");

                        if (value.url) {
                          a.dataset.url = facet.url + "/" + value.url.replace(/%22/g, '"');
                        } else {
                          a.dataset.url = "";
                        }

                        addImage(text, imagesURL[i]);
                        a.appendChild(text);

                        $(a).click(function () {
                          var children = $("#height-button").children();
                          $("#height-button").text($(this).children(".dropdown-title").text());
                          $("#height-button").append(children);
                          $("#height-button").data("url", $(this).data("url"));
                        });

                        li.appendChild(a);
                        sizeSelectList.appendChild(li);
                      }
                      i++;
                    });
                  }
                });
              }

              if (categories) {
                categories.forEach(function (category) {
                  var li = document.createElement("li");
                  var a = document.createElement("a");
                  var title = document.createElement("p");
                  var subtitle = document.createElement("p");

                  title.classList.add("dropdown-title");
                  subtitle.classList.add("dropdown-subtitle");

                  title.innerHTML = category.text;
                  subtitle.innerHTML = category.dataHashtag;
                  a.dataset.url = category.href;
                  a.appendChild(title);
                  a.appendChild(subtitle);
                  $(a).click(function () {
                    var children = $("#system-button").children();
                    $("#system-button").text(category.text);
                    $("#system-button").append(children);
                    $("#system-button").data("url", $(this).data("url"));
                  });

                  li.appendChild(a);
                  systemSelectList.appendChild(li);
                });
              }

              //System dropdown
              $(document).ready(function () {
                $("#system-button").click(function () {
                  $("#system-list .disabled").addClass("hovered");
                });

                $("#system-list li").hover(
                  function () {
                    $(this).children("a").children("p").css("color", "white");
                    $("#system-list .disabled").removeClass("hovered");
                  },
                  function () {
                    $(this).children("a").children(".dropdown-subtitle").css("color", "#585858");
                    $(this).children("a").children(".dropdown-title").css("color", "black");
                  }
                );
              });

              //Height dropdown
              $(document).ready(function () {
                $("#height-button").click(function () {
                  $("#height-list .disabled").addClass("hovered");
                });

                $("#height-list li").hover(
                  function () {
                    $(this).children("a").children("p").css("color", "white");
                    $("#height-list .disabled").removeClass("hovered");
                  },
                  function () {
                    $(this).children("a").children(".dropdown-title").css("color", "#585858");
                  }
                );
              });

              //Submit quick search
              submiteBtn.addEventListener("click", function (e) {
                e.preventDefault();
                var selectedValues = [];

                var selectedSystem = $("#system-button").data("url");
                if (selectedSystem) {
                  selectedValues.push(selectedSystem);
                }

                var selectedHeight = $("#height-button").data("url");
                if (selectedHeight) {
                  selectedValues.push(selectedHeight);
                }

                var selectedHand = handSelect.options[handSelect.selectedIndex].value;
                if (selectedHand !== "") {
                  selectedValues.push(selectedHand);
                }

                if (selectedValues.length > 0) {
                  var searchString = selectedValues.join("/");
                  Backbone.history.navigate(searchString, { trigger: true });
                }
              });
            };
          }
        }, 2000);
      });
    },
  };
});


};

extensions['ACS.Embroidery.4.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/ACS/Embroidery/4.0.0/' + asset;
};


define('ACS.Embroidery.CartManager', [
    'Cart.Lines.View',
    'underscore',
    'LiveOrder.Model',
    'Backbone'
]
, function Embroidery(
    CartLinesView,
   _,
  LiveOrderModel,
  Backbone
    ) {
    'use strict';

    return _.extend(CartLinesView.prototype, {
        events: {
            'click [data-action="remove-logo"]': 'removeLogoOption',

            'click [data-action="remove-text"]': 'removeTextOption'
        },
        removeLogoOption: function removeLogoOption(e) {
            var lineId = this.model.id;
            var liveOrder = LiveOrderModel.getInstance();
            var lines = liveOrder.get('lines');
            var options = [];
            lines.forEach(function forEach(line) {
                if (line.get('internalid') === lineId) {
                    options = [];
                    line.get('options').forEach(function (option) {
                        if (
                            option.get('cartOptionId') !== 'custcol_kd_embroidery' &&
                            option.get('cartOptionId') !== 'custcol_kd_embroidery_logo_cost' &&
                            option.get('cartOptionId') !== 'custcol_kd_embroidery_free_qty'
                          ) {
                            options.push(option);
                        }
                    });

                    line.set('options', new Backbone.Collection(options));

                    liveOrder.updateLine(line);
                }
            });
        },
        removeTextOption: function removeTextOption(e) {
            var lineId = this.model.id;
            var liveOrder = LiveOrderModel.getInstance();
            var lines = liveOrder.get('lines');
            var options = [];
            lines.forEach(function forEach(line) {
                if (line.get('internalid') === lineId) {
                    options = [];
                    line.get('options').forEach(function forEachOption(option) {
                        if (
                          option.get('cartOptionId') !== 'custcol_kd_embroidery_text' &&
                          option.get('cartOptionId') !== 'custcol_kd_embroidery_text_option' &&
                          option.get('cartOptionId') !== 'custcol_kd_embroidery_text_cost' &&
                          option.get('cartOptionId') !== 'custcol_kd_embroidery_free_qty'
                      ) {
                            options.push(option);
                        }
                    });

                    line.set('options', new Backbone.Collection(options));

                    liveOrder.updateLine(line);
                }
            });
        }
    });
});


define('ACS.Embroidery.Item.Model', [
    'Backbone',
    'Utils'
],
    function EmbroideryItemModel(
        Backbone,
        Utils
    ) {
        'use strict';

        return Backbone.Model.extend({

            initialize: function initialize(options) {
                this.searchApiMasterOptions = options.environment.getConfig('searchApiMasterOptions.itemDetails');
                delete this.searchApiMasterOptions.fieldset;
            },
            urlRoot: function urlRoot() {
                var url = Utils.addParamsToUrl(
                    '/api/items',
                    this.searchApiMasterOptions
                );
                return url;
            }
        });
    });


// Model.js
// -----------------------
// @module Case
define('ACS.Embroidery.Main.Model', [
    'Backbone',
    'Utils'
], function EmbroideryModel(
    Backbone,
    Utils
) {
    'use strict';

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({


        // @property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            // eslint-disable-next-line no-undef
            getExtensionAssetsPath(
                'services/Main.Service.ss'
            )
        )

    });
});


/* eslint-disable radix */
// @module ACS.Embroidery.Main
define('ACS.Embroidery.Main.View', [
    'acs_embroidery_main.tpl',
    'Backbone',
    'jQuery',
    'Profile.Model',
    'ACS.Embroidery.Item.Model',
    'underscore'
]
, function Embroidery(
    acsEmbroideryMainTpl,
    Backbone,
    jQuery,
    ProfileModel,
    EmbroideryItemModel,
    _
) {
    'use strict';

    return Backbone.View.extend({
        typeMap: {
            'block': '1',
            'script': '2'
        },
        template: acsEmbroideryMainTpl,

        initialize: function initialize() {
            var self = this;
            var modelFetch;
            var itemDataFetch;
            var itemType;
            this.user = ProfileModel.getInstance();
            this.isOpen = false;
            this.logoSelected = false;
            this.personalizationType = '';
            this.showPersonalization = false;
            this.showLogo = false;
            this.enableClubLogo = true;
            this.cart = this.options.cart;
            this.addingToCart = false;
            this.time = (new Date()).getTime().toString();
            this.logos = [];
            if (!this.options.pdp.getItemInfo().item.custitem_logo_mapping) {
                return;
            }
            if (!this.options.pdp.getItemInfo().item.custitem_logo_mapping && !this.options.pdp.getItemInfo().item.custitem_pers_map) {
                this.enableClubLogo = false;
                return;
            }
            modelFetch = this.model.fetch({
                data: {
                    itemid: this.options.pdp.getItemInfo().item.internalid
                }
            });

            itemDataFetch = new EmbroideryItemModel({ environment: this.options.environment }).fetch({
                data: {
                    id: this.options.pdp.getItemInfo().item.custitem_logo_mapping + ',' + this.options.pdp.getItemInfo().item.custitem_pers_map,
                    fields: 'internalid,onlinecustomerprice'
                }
            });
            // eslint-disable-next-line no-undef
            jQuery.when(modelFetch, itemDataFetch).then(function modelFetchdone(model, itemModel) {
                if (itemModel && itemModel[0].items) {
                    self.model.set('embroideryItems', itemModel[0].items);
                }
                itemType = self.options.pdp.getItemInfo().item.custitem3;
                if (self.model.get('customerLogos').length > 0) {
                    _.each(self.model.get('customerLogos'), function customerLogos(logo) {
                        if (logo.types.split(',').indexOf(itemType) >= 0) {
                            self.logos.push(logo);
                        }
                    });
                } else {
                    self.logos = self.model.get('globalLogos');
                }
                self.render();
            });
            this.cart.on('afterAddLine', function afterAddline() {
                self.time = (new Date()).getTime().toString();
                self.options.pdp.setOption('custcol_logo_reference', self.time);
                self.resetValues();
            });
        },
        getItemOptionFormatted: function getItemOptionFormatted(name, value) {
            return {
                'cartOptionId': name,
                'value': {
                    'internalid': value
                }
            };
        },
        events: {
            'click #clear-text-selection': 'clearText',
            'click .fake-minimize': 'OpenHanndler',
            'click .fake-plus': 'OpenHanndler',
            'click [data-emb-type]': 'selectType',
            'click #clear-type-fake-none': 'clearSections',
            'click #clear-logo-selection': 'clearLogo',
            'click .logo-selection-option': 'selectLogo',
            'blur #text-area-personalization': 'setOptionText',
            'change [name=text-type]': 'changeTypeText'
        },
        clearText: function clearText() {
            jQuery('#text-area-personalization').val('');
            jQuery('#block').click();
        },
        clearLogo: function clearLogo() {
            this.selectLogo();
        },
        changeTypeText: function changeTypeText() {
            this.personalizationType = this.typeMap[jQuery('[name=text-type]:checked').val()];
            this.options.pdp.setOption('custcol_kd_embroidery_text_option', this.personalizationType);
        },
        setOptionText: function setOptionText() {
            var textValue = jQuery('#text-area-personalization').val();
            this.embroideryText = textValue.replace('\n', '<br>');
            this.options.pdp.setOption('custcol_kd_embroidery_text', this.embroideryText);
        },
        OpenHanndler: function OpenHanndler() {
            this.isOpen = !this.isOpen;
            this.render();
        },
        selectLogo: function selectLogo(el) {
            var clickElement = el ? jQuery(el.currentTarget) : '';
            var results = this.model.get('results');
            var selectedLogoUrl;
            var self = this;
            _.each(this.logos, function eachresults(logo, index) {
                if (clickElement && logo.id.toString() === clickElement.attr('data-logo-id')) {
                    self.logos[index].selected = true;
                    selectedLogoUrl = self.logos[index].src;
                } else {
                    self.logos[index].selected = false;
                }
            });
            _.each(results, function eachresults(result, index) {
                if (result.selected) {
                    results[index].logoUrl = clickElement && clickElement.attr('src');
                } else {
                    delete results[index].logoUrl;
                }
            });
            if (selectedLogoUrl) {
                selectedLogoUrl = document.location.origin + selectedLogoUrl;
                this.options.pdp.setOption('custcol_kd_embroidery', selectedLogoUrl);
                this.imageUrl = selectedLogoUrl;
            } else {
                this.options.pdp.setOption('custcol_kd_embroidery', '');
            }
            this.options.pdp.setOption('custcol_pers_reference',
                this.options.pdp.getItemInfo().item.custitem_logo_mapping + ',' + this.options.pdp.getItemInfo().item.custitem_pers_map
            );
            this.model.set('results', results);
            this.render();
        },
        selectType: function selectType(el) {
            var container = jQuery(el.target).parent();
            var type = container.attr('data-emb-type');
            var results = this.model.get('results');
            var options = this.options.pdp.getItemInfo().options;
            var itemModels = this.model.get('embroideryItems');
            var logoItem = _.find(itemModels, { internalid: parseInt(this.options.pdp.getItemInfo().item.custitem_logo_mapping) });
            var textItem = _.find(itemModels, { internalid: parseInt(this.options.pdp.getItemInfo().item.custitem_pers_map) });
            var currentLogoReference = _.find(options, { cartOptionId: 'custcol_logo_reference' });
            if (!currentLogoReference.value || (currentLogoReference.value && currentLogoReference.value.internalid !== this.time)) {
                this.options.pdp.setOption('custcol_logo_reference', this.time);
            }
            this.options.pdp.setOption('custcol_pers_reference',
                this.options.pdp.getItemInfo().item.custitem_logo_mapping + ',' + this.options.pdp.getItemInfo().item.custitem_pers_map
            );
            _.each(results, function eachresults(result, index) {
                if (result.type === type) {
                    results[index].selected = true;
                } else {
                    results[index].selected = false;
                }
            });
            if (type === '1') {
                this.options.pdp.setOption('custcol_kd_embroidery_logo_cost', logoItem.onlinecustomerprice.toString());
                this.options.pdp.setOption('custcol_kd_embroidery_text_cost', '');
            } else if (type === '2') {
                this.options.pdp.setOption('custcol_kd_embroidery_logo_cost', '');
                this.options.pdp.setOption('custcol_kd_embroidery_text_cost', textItem.onlinecustomerprice.toString());
            } else {
                this.options.pdp.setOption('custcol_kd_embroidery_text_cost', textItem.onlinecustomerprice.toString());
                this.options.pdp.setOption('custcol_kd_embroidery_logo_cost', logoItem.onlinecustomerprice.toString());
            }
            this.model.set('results', results);
            this.logoSelected = true;
            this.showPersonalization = type !== '1';
            this.showLogo = type !== '2';
            this.embroiryText = type;
            if (!this.showPersonalization) {
                this.options.pdp.setOption('custcol_kd_embroidery_text_option', '');
                this.options.pdp.setOption('custcol_kd_embroidery_text', '');
            } else {
                this.personalizationType = this.typeMap[jQuery('[name=text-type]:checked').val()];
                this.options.pdp.setOption('custcol_kd_embroidery_text_option', this.personalizationType);
            }


            this.render();
        },
        clearSections: function clearSections() {
            var results = this.model.get('results');
            _.each(results, function eachresults(result, index) {
                results[index].selected = false;
            });
            this.options.pdp.setOption('custcol_kd_embroidery_text_cost', '');
            this.options.pdp.setOption('custcol_kd_embroidery_logo_cost', '');
            this.options.pdp.setOption('custcol_kd_embroidery_text_option', '');
            this.options.pdp.setOption('custcol_kd_embroidery_text', '');
            jQuery('#text-area-personalization').val('');
            this.showPersonalization = false;
            this.showLogo = false;
            this.selectLogo();
            this.render();
        },
        resetClass: function resetClass(className) {
            jQuery('.' + className).each(function classNamea() {
                jQuery(this).removeClass(className);
            });
        },
        openMenuBtn: function openMenuBtn(el) {
            jQuery(el.target).hide();
            jQuery('.fake-minimize').show();
            jQuery('.personalize-content').addClass('showing-content-menu');
            jQuery('.personalize-menu').addClass('showing-pers-menu');
        },
        hideMenuBtn: function hideMenuBtn(el) {
            jQuery(el.target).hide();
            jQuery('.fake-plus').show();
            jQuery('.personalize-content').removeClass('showing-content-menu');
            jQuery('.personalize-menu').removeClass('showing-pers-menu');
        },
        resetValues: function resetValues() {
            var results = this.model.get('results');
            this.user = ProfileModel.getInstance();
            this.isOpen = false;
            this.logoSelected = false;
            this.personalizationType = '';
            this.showPersonalization = false;
            this.cart = this.options.cart;
            this.time = (new Date()).getTime().toString();
            _.each(results, function eachresults(result, index) {
                results[index].selected = false;
            });
            this.options.pdp.setOption('custcol_kd_embroidery_text_option', '');
            this.options.pdp.setOption('custcol_logo_reference', '');
            this.options.pdp.setOption('custcol_logo_reference', '');
            this.options.pdp.setOption('custcol_kd_embroidery', '');
            this.options.pdp.setOption('custcol_kd_embroidery_text', '');
        },

        getContext: function getContext() {
            var popUpText = this.options.environment.getConfig('KDEmbroidery.popUpText');
            var multipleAddToCartMessage = this.options.environment.getConfig('Embrodery.multipleaddmessage');
            var isLogged = this.user.get('isLoggedIn') === 'T';
            if (this.options.environment.getConfig('KDEmbroidery.config') === 'B2C') {
                isLogged = true;
            }
            return {
                isLogged: isLogged,
                enableClubLogo: this.model.get('results') && this.model.get('results').length > 0,
                results: this.model.get('results') || [],
                globalLogos: this.logos || [],
                hasCustomerLogos: (this.logos || []).length > 0,
                isOpen: this.isOpen,
                logoSelected: this.logoSelected,
                showPersonalization: this.showPersonalization,
                popUpText: popUpText,
                showLogo: this.showLogo,
                multipleAddToCartMessage: multipleAddToCartMessage
            };
        }
    });
});



define('ACS.Embroidery.Main', [
    'ACS.Embroidery.Main.View',
    'ACS.Embroidery.Main.Model',
    'Tracker',
    'underscore',
    'ProductDetails.Full.View',
    'Handlebars',
    'Backbone',
    'Transaction.Line.Views.Option.View',
    'ACS.Embroidery.CartManager'

]
, function Embroidery(
    MainView,
    EmbroideryModel,
    Tracker,
    _,
    PDPFullView,
    Handlebars,
    Backbone,
    TransactionLineViewsOptionView
    ) {
    'use strict';

    Handlebars.registerHelper('generateBreak', function generateBreak(text) {
        var string = unescape(text).replace('LINEBREAK', '<br>');
        return new Handlebars.SafeString(string);
    });

    _.extend(Tracker.prototype, {
        trackAddToCart: function trackAddToCart(e) {
            return this.track('trackEvent', {
                category: 'Shopping - User Interaction',
                action: 'Add To Cart',
                label: e ? e.generateURL() : ''
            }).track('trackAddToCart', e);
        }
    });
    _.extend(TransactionLineViewsOptionView.prototype, {
        getContext: _.wrap(TransactionLineViewsOptionView.prototype.getContext, function getContext(fn) {
            var context = fn.apply(this, _.toArray(arguments).slice(1));
            context.isCart = Backbone.history.getFragment().indexOf('cart') >= 0;
            return context;
        })
    });
    return {
        mountToApp: function mountToApp(container) {
            var pdp = container.getComponent('PDP');
            var environment = container.getComponent('Environment');
            var cart = container.getComponent('Cart');
            var self = this;


            this.embroideryViews = {};
            if (!environment.isPageGenerator()) {
                _.extend(PDPFullView.prototype, {
                    childViews: _.extend(PDPFullView.prototype.childViews, {
                        'Embroidery.View': function EmbroideryView() {
                            var itemId = this.model.getItem().get('itemid');
                            if (!self.embroideryViews[itemId]) {
                                self.embroideryViews[itemId] = new MainView({ pdp: pdp, model: new EmbroideryModel(), environment: environment, cart: cart });
                            }
                            self.embroideryViews[itemId].resetValues();
                            return self.embroideryViews[itemId];
                        }
                    })
                });
            }
        }
    };
});


};

extensions['Kodella.KDStockGlobal.1.3.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/Kodella/KDStockGlobal/1.3.0/' + asset;
};

define('Kodella.KDStockGlobal.KDStockGlobal', [
    'ProductLine.Stock.View',
    'SC.Configuration',
    'ProductDetails.Base.View',
    'ProductDetails.QuickView.View',
    'underscore',
    'jQuery'
], function KodellaKDStockGlobalKDStockGlobal(
    ProductLineStockView,
    Configuration,
    ProductDetailsBaseView,
    ProductDetailsQuickViewView,
    _,
    jQuery
) {
    'use strict';

    return {
        mountToApp: function mountToApp(container) {
            var self = this;
            this.pdp = container.getComponent('PDP');
            if (this.pdp) {
                this.pdp.on('afterOptionSelection', function afterOS() {
                    var selectedMatrix = self.pdp && self.pdp.getSelectedMatrixChilds();
                    var isInStock;
                    var itemStockCustom;
                    var $htmlToSet = '<section class="product-details-full-actions"><div class="product-line-stock">' +
                        '<p class="product-line-stock-msg-out" style="color:black; border : 1px solid Orange">' +
                        '<span class="product-line-stock-icon-out"><i></i></span>' +
                        '<span class="product-line-stock-msg-out-text">' + Configuration.KDStockGlobal.text + ' </span></p></div></section>';
                    if (selectedMatrix && selectedMatrix.length === 1) {
                        itemStockCustom = _.first(selectedMatrix).custitem_in_stock;
                        isInStock = _.first(selectedMatrix).isinstock;
                        if (!itemStockCustom && !isInStock) {
                            jQuery('[data-view="MainActionView"]').html($htmlToSet);
                            jQuery('.product-details-quantity-options').hide();
                            jQuery('[data-view="Quantity"]').hide();
                        } else {
                            jQuery('.product-details-quantity-options').show();
                            jQuery('[data-view="Quantity"]').show();
                        }
                    }
                });
            }

            ProductLineStockView.prototype.getContext = _.wrap(ProductLineStockView.prototype.getContext, function getctxPL(fn) {
                var context = fn.apply(this, _.toArray(arguments).slice(1));
                var itemModel = this.model.get('item') ? this.model.get('item') : this.model;
                var inStockCustom = itemModel.get('custitem_in_stock');
                var quantityAvailable = itemModel.get('quantityavailable');
                if (!inStockCustom && quantityAvailable <= 0) {
                    context.customShowMsg = Configuration.KDStockGlobal.showMessage;
                    context.customStockColor = Configuration.KDStockGlobal.color;
                    context.customStockBorderColor = Configuration.KDStockGlobal.borderColor;
                    context.customStockText = Configuration.KDStockGlobal.text;
                }
                return context;
            });

            ProductDetailsBaseView.prototype.getContext = _.wrap(ProductDetailsBaseView.prototype.getContext, function getctxBV(fn) {
                var context = fn.apply(this, _.toArray(arguments).slice(1));
                var itemModel = this.model.get('item') ? this.model.get('item') : this.model;
                var inStockCustom = itemModel.get('custitem_in_stock');
                var quantityAvailable = itemModel.get('quantityavailable');
                var itemType = context && context.model && context.model.get('item') && context.model.get('item').get('itemtype');
                if (!inStockCustom && quantityAvailable <= 0) {
                    context.customShowMsg = Configuration.KDStockGlobal.showMessage;
                    context.customShowAddToCart = Configuration.KDStockGlobal.allowBackOrder;
                } else {
                    context.customShowMsg = false;
                    context.customShowAddToCart = true;
                }
                if (itemType === 'GiftCert') {
                    context.customShowMsg = false;
                    context.customShowAddToCart = true;
                }
                return context;
            });

            ProductDetailsQuickViewView.prototype.getContext = _.wrap(ProductDetailsQuickViewView.prototype.getContext, function getctxqv(fn) {
                var context = fn.apply(this, _.toArray(arguments).slice(1));
                var itemModel = this.model.get('item') ? this.model.get('item') : this.model;
                var inStockCustom = itemModel.get('custitem_in_stock');
                var quantityAvailable = itemModel.get('quantityavailable');
                var itemType = context && context.model && context.model.get('item') && context.model.get('item').get('itemtype');
                if (!inStockCustom && quantityAvailable <= 0) {
                    context.customShowMsg = Configuration.KDStockGlobal.showMessage;
                    context.customShowAddToCart = Configuration.KDStockGlobal.allowBackOrder;
                } else {
                    context.customShowMsg = false;
                    context.customShowAddToCart = true;
                }
                if (itemType === 'GiftCert') {
                    context.customShowMsg = false;
                    context.customShowAddToCart = true;
                }
                return context;
            });
        }
    };
});


};

extensions['Kodella.KDStrikethrough.1.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/Kodella/KDStrikethrough/1.0.0/' + asset;
};

// @module Kodella.KDStrikethrough.KDStrikethrough
define('Kodella.KDStrikethrough.KDStrikethrough.View'
,	[
	'kodella_kdstrikethrough_kdstrikethrough.tpl'
	
	,	'Kodella.KDStrikethrough.KDStrikethrough.SS2Model'
	
	,	'Backbone'
    ]
, function (
	kodella_kdstrikethrough_kdstrikethrough_tpl
	
	,	KDStrikethroughSS2Model
	
	,	Backbone
)
{
    'use strict';

	// @class Kodella.KDStrikethrough.KDStrikethrough.View @extends Backbone.View
	return Backbone.View.extend({

		template: kodella_kdstrikethrough_kdstrikethrough_tpl

	,	initialize: function (options) {

			/*  Uncomment to test backend communication with an example service
				(you'll need to deploy and activate the extension first)
			*/

			// this.model = new KDStrikethroughModel();
			// var self = this;
         	// this.model.fetch().done(function(result) {
			// 	self.message = result.message;
			// 	self.render();
			  // });
		}

	,	events: {
		}

	,	bindings: {
		}

	, 	childViews: {

		}

		//@method getContext @return Kodella.KDStrikethrough.KDStrikethrough.View.Context
	,	getContext: function getContext()
		{
			//@class Kodella.KDStrikethrough.KDStrikethrough.View.Context
			/* this.message = this.message || 'Hello World!!'
			return {
				message: this.message
			}; */
		}
	});
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDStrikethrough.KDStrikethrough.Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({

        
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "services/KDStrikethrough.Service.ss"
            )
        )
        
});
});


// Model.js
// -----------------------
// @module Case
define("Kodella.KDStrikethrough.KDStrikethrough.SS2Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "Modules/KDStrikethrough/SuiteScript2/KDStrikethrough.Service.ss"
            ),
            true
        )
});
});


define("Kodella.KDStrikethrough.KDStrikethrough", [
  "Kodella.KDStrikethrough.KDStrikethrough.View",
  "Kodella.KDStrikethrough.KDStrikethrough.Model",
  "ProductViews.Price.View",
  "Profile.Model",
], function (KDStrikethroughView, Model, ProductViewsPriceView, ProfileModel) {
  "use strict";

  return {
    mountToApp: function mountToApp(container) {
      // using the 'Layout' component we add a new child view inside the 'Header' existing view
      // (there will be a DOM element with the HTML attribute data-view="Header.Logo")
      // more documentation of the Extensibility API in
      // https://system.netsuite.com/help/helpcenter/en_US/APIs/SuiteCommerce/Extensibility/Frontend/index.html

      /** @type {LayoutComponent} */

      ProductViewsPriceView.prototype.getContext = _.wrap(ProductViewsPriceView.prototype.getContext, function (fn) {
        var context = fn.apply(this, _.toArray(arguments).slice(1));
        var profile = ProfileModel.getInstance();
        var hasSalePriceCUSTOMER = profile.attributes.priceLevel != "5" ? true : false;
        var showStrike = false;
        var priceLevel37; //Online Sale Price
        var priceLevel5;  //Online Price
        var priceLevel5_unformatted;
        var currentPrice;

        try {
          priceLevel37 = this.model.attributes.item.attributes.pricelevel37_formatted;
          priceLevel5 = this.model.attributes.item.attributes.pricelevel5_formatted;
          if (priceLevel5)
            priceLevel5_unformatted = priceLevel5.match(/[0-9.]/g).join("");
          currentPrice = this.model.attributes.item.attributes._priceDetails.onlinecustomerprice;
        } catch (e) {
          console.log(e)
        }

        // 
        // if (hasSalePriceCUSTOMER) {
        //   if (priceLevel37 != priceLevel5) {
        //     //means that the item has a SALE PRICE
        //     showStrike = true;
        //   }
        // }

        if (priceLevel37 && priceLevel5 && currentPrice) {
          //B2C
          try {
            if (SC.CONFIGURATION.KDEmbroidery.config === "B2C") {
              if (currentPrice < priceLevel5_unformatted) {
                //means that the item has a SALE PRICE
                showStrike = true;
              }
            }
          }
          catch (e) {
            console.log(e);
          }

          //B2B
          try {
            if (SC.CONFIGURATION.KDEmbroidery.config === "B2B") {
              //Not logged in
              if (profile.attributes.isLoggedIn === "F") {
                if (currentPrice < priceLevel5_unformatted) {
                  //means that the item has a SALE PRICE
                  showStrike = true;
                }
              }
              //Logged in
              else if (profile.attributes.isLoggedIn === "T") {
                showStrike = false;
              }
            }
          }
          catch (e) {
            console.log(e);
          }

          context.showStrike = showStrike;
          context.oldPrice = priceLevel5;
        }

        return context;
      });
    },
  };
});


};

extensions['NetSuite.Slideshow.1.0.2'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/NetSuite/Slideshow/1.0.2/' + asset;
};

define('jQuery.bxSlider@4.2.14', ['jQuery'], function () {

    ;(function($) {

        var defaults = {

            // GENERAL
            mode: 'horizontal',
            slideSelector: '',
            infiniteLoop: true,
            hideControlOnEnd: false,
            speed: 500,
            easing: null,
            slideMargin: 0,
            startSlide: 0,
            randomStart: false,
            captions: false,
            ticker: false,
            tickerHover: false,
            adaptiveHeight: false,
            adaptiveHeightSpeed: 500,
            video: false,
            useCSS: true,
            preloadImages: 'visible',
            responsive: true,
            slideZIndex: 50,
            wrapperClass: 'bx-wrapper',

            // TOUCH
            touchEnabled: true,
            swipeThreshold: 50,
            oneToOneTouch: true,
            preventDefaultSwipeX: true,
            preventDefaultSwipeY: false,

            // ACCESSIBILITY
            ariaLive: true,
            ariaHidden: true,

            // KEYBOARD
            keyboardEnabled: false,

            // PAGER
            pager: true,
            pagerType: 'full',
            pagerShortSeparator: ' / ',
            pagerSelector: null,
            buildPager: null,
            pagerCustom: null,

            // CONTROLS
            controls: true,
            nextText: 'Next',
            prevText: 'Prev',
            nextSelector: null,
            prevSelector: null,
            autoControls: false,
            startText: 'Start',
            stopText: 'Stop',
            autoControlsCombine: false,
            autoControlsSelector: null,

            // AUTO
            auto: false,
            pause: 4000,
            autoStart: true,
            autoDirection: 'next',
            stopAutoOnClick: false,
            autoHover: false,
            autoDelay: 0,
            autoSlideForOnePage: false,

            // CAROUSEL
            minSlides: 1,
            maxSlides: 1,
            moveSlides: 0,
            slideWidth: 0,
            shrinkItems: false,

            // CALLBACKS
            onSliderLoad: function() { return true; },
            onSlideBefore: function() { return true; },
            onSlideAfter: function() { return true; },
            onSlideNext: function() { return true; },
            onSlidePrev: function() { return true; },
            onSliderResize: function() { return true; },
            onAutoChange: function() { return true; } //calls when auto slides starts and stops
        };

        $.fn.bxSliderNew = function(options) {

            if (this.length === 0) {
                return this;
            }

            // support multiple elements
            if (this.length > 1) {
                this.each(function() {
                    $(this).bxSliderNew(options);
                });
                return this;
            }

            // create a namespace to be used throughout the plugin
            var slider = {},
                // set a reference to our slider element
                el = this,
                // get the original window dimens (thanks a lot IE)
                windowWidth = $(window).width(),
                windowHeight = $(window).height();

            // Return if slider is already initialized
            if ($(el).data('bxSlider')) { return; }

            /**
             * ===================================================================================
             * = PRIVATE FUNCTIONS
             * ===================================================================================
             */

            /**
             * Initializes namespace settings to be used throughout plugin
             */
            var init = function() {
                // Return if slider is already initialized
                if ($(el).data('bxSlider')) { return; }
                // merge user-supplied options with the defaults
                slider.settings = $.extend({}, defaults, options);
                // parse slideWidth setting
                slider.settings.slideWidth = parseInt(slider.settings.slideWidth);
                // store the original children
                slider.children = el.children(slider.settings.slideSelector);
                // check if actual number of slides is less than minSlides / maxSlides
                if (slider.children.length < slider.settings.minSlides) { slider.settings.minSlides = slider.children.length; }
                if (slider.children.length < slider.settings.maxSlides) { slider.settings.maxSlides = slider.children.length; }
                // if random start, set the startSlide setting to random number
                if (slider.settings.randomStart) { slider.settings.startSlide = Math.floor(Math.random() * slider.children.length); }
                // store active slide information
                slider.active = { index: slider.settings.startSlide };
                // store if the slider is in carousel mode (displaying / moving multiple slides)
                slider.carousel = slider.settings.minSlides > 1 || slider.settings.maxSlides > 1;
                // if carousel, force preloadImages = 'all'
                if (slider.carousel) { slider.settings.preloadImages = 'all'; }
                // calculate the min / max width thresholds based on min / max number of slides
                // used to setup and update carousel slides dimensions
                slider.minThreshold = (slider.settings.minSlides * slider.settings.slideWidth) + ((slider.settings.minSlides - 1) * slider.settings.slideMargin);
                slider.maxThreshold = (slider.settings.maxSlides * slider.settings.slideWidth) + ((slider.settings.maxSlides - 1) * slider.settings.slideMargin);
                // store the current state of the slider (if currently animating, working is true)
                slider.working = false;
                // initialize the controls object
                slider.controls = {};
                // initialize an auto interval
                slider.interval = null;
                // determine which property to use for transitions
                slider.animProp = slider.settings.mode === 'vertical' ? 'top' : 'left';
                // determine if hardware acceleration can be used
                slider.usingCSS = slider.settings.useCSS && slider.settings.mode !== 'fade' && (function() {
                    // create our test div element
                    var div = document.createElement('div'),
                        // css transition properties
                        props = ['WebkitPerspective', 'MozPerspective', 'OPerspective', 'msPerspective'];
                    // test for each property
                    for (var i = 0; i < props.length; i++) {
                        if (div.style[props[i]] !== undefined) {
                            slider.cssPrefix = props[i].replace('Perspective', '').toLowerCase();
                            slider.animProp = '-' + slider.cssPrefix + '-transform';
                            return true;
                        }
                    }
                    return false;
                }());
                // if vertical mode always make maxSlides and minSlides equal
                if (slider.settings.mode === 'vertical') { slider.settings.maxSlides = slider.settings.minSlides; }
                // save original style data
                el.data('origStyle', el.attr('style'));
                el.children(slider.settings.slideSelector).each(function() {
                    $(this).data('origStyle', $(this).attr('style'));
                });

                // perform all DOM / CSS modifications
                setup();
            };

            /**
             * Performs all DOM and CSS modifications
             */
            var setup = function() {
                var preloadSelector = slider.children.eq(slider.settings.startSlide); // set the default preload selector (visible)

                // wrap el in a wrapper
                el.wrap('<div class="' + slider.settings.wrapperClass + '"><div class="bx-viewport"></div></div>');
                // store a namespace reference to .bx-viewport
                slider.viewport = el.parent();

                // add aria-live if the setting is enabled and ticker mode is disabled
                if (slider.settings.ariaLive && !slider.settings.ticker) {
                    slider.viewport.attr('aria-live', 'polite');
                }
                // add a loading div to display while images are loading
                slider.loader = $('<div class="bx-loading" />');
                slider.viewport.prepend(slider.loader);
                // set el to a massive width, to hold any needed slides
                // also strip any margin and padding from el
                el.css({
                    width: slider.settings.mode === 'horizontal' ? (slider.children.length * 1000 + 215) + '%' : 'auto',
                    position: 'relative'
                });
                // if using CSS, add the easing property
                if (slider.usingCSS && slider.settings.easing) {
                    el.css('-' + slider.cssPrefix + '-transition-timing-function', slider.settings.easing);
                    // if not using CSS and no easing value was supplied, use the default JS animation easing (swing)
                } else if (!slider.settings.easing) {
                    slider.settings.easing = 'swing';
                }
                // make modifications to the viewport (.bx-viewport)
                slider.viewport.css({
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative'
                });
                slider.viewport.parent().css({
                    maxWidth: getViewportMaxWidth()
                });
                // apply css to all slider children
                slider.children.css({
                    // the float attribute is a reserved word in compressors like YUI compressor and need to be quoted #48
                    'float': slider.settings.mode === 'horizontal' ? 'left' : 'none',
                    listStyle: 'none',
                    position: 'relative'
                });
                // apply the calculated width after the float is applied to prevent scrollbar interference
                slider.children.css('width', getSlideWidth());
                // if slideMargin is supplied, add the css
                if (slider.settings.mode === 'horizontal' && slider.settings.slideMargin > 0) { slider.children.css('marginRight', slider.settings.slideMargin); }
                if (slider.settings.mode === 'vertical' && slider.settings.slideMargin > 0) { slider.children.css('marginBottom', slider.settings.slideMargin); }
                // if "fade" mode, add positioning and z-index CSS
                if (slider.settings.mode === 'fade') {
                    slider.children.css({
                        position: 'absolute',
                        zIndex: 0,
                        display: 'none'
                    });
                    // prepare the z-index on the showing element
                    slider.children.eq(slider.settings.startSlide).css({zIndex: slider.settings.slideZIndex, display: 'block'});
                }
                // create an element to contain all slider controls (pager, start / stop, etc)
                slider.controls.el = $('<div class="bx-controls" />');
                // if captions are requested, add them
                if (slider.settings.captions) { appendCaptions(); }
                // check if startSlide is last slide
                slider.active.last = slider.settings.startSlide === getPagerQty() - 1;
                // if video is true, set up the fitVids plugin
                if (slider.settings.video) { el.fitVids(); }
                //preloadImages
                if (slider.settings.preloadImages === 'none') {
                    preloadSelector = null;
                }
                else if (slider.settings.preloadImages === 'all' || slider.settings.ticker) {
                    preloadSelector = slider.children;
                }
                // only check for control addition if not in "ticker" mode
                if (!slider.settings.ticker) {
                    // if controls are requested, add them
                    if (slider.settings.controls) { appendControls(); }
                    // if auto is true, and auto controls are requested, add them
                    if (slider.settings.auto && slider.settings.autoControls) { appendControlsAuto(); }
                    // if pager is requested, add it
                    if (slider.settings.pager) { appendPager(); }
                    // if any control option is requested, add the controls wrapper
                    if (slider.settings.controls || slider.settings.autoControls || slider.settings.pager) { slider.viewport.after(slider.controls.el); }
                    // if ticker mode, do not allow a pager
                } else {
                    slider.settings.pager = false;
                }
                if (preloadSelector === null) {
                    start();
                } else {
                    loadElements(preloadSelector, start);
                }
            };

            var loadElements = function(selector, callback) {
                var total = selector.find('img:not([src=""]), iframe').length,
                    count = 0;
                if (total === 0) {
                    callback();
                    return;
                }
                selector.find('img:not([src=""]), iframe').each(function() {
                    $(this).one('load error', function() {
                        if (++count === total) { callback(); }
                    }).each(function() {
                        if (this.complete || this.src == '') { $(this).trigger('load'); }
                    });
                });
            };

            /**
             * Start the slider
             */
            var start = function() {
                // if infinite loop, prepare additional slides
                if (slider.settings.infiniteLoop && slider.settings.mode !== 'fade' && !slider.settings.ticker) {
                    var slice    = slider.settings.mode === 'vertical' ? slider.settings.minSlides : slider.settings.maxSlides,
                        sliceAppend  = slider.children.slice(0, slice).clone(true).addClass('bx-clone'),
                        slicePrepend = slider.children.slice(-slice).clone(true).addClass('bx-clone');
                    if (slider.settings.ariaHidden) {
                        sliceAppend.attr('aria-hidden', true);
                        slicePrepend.attr('aria-hidden', true);
                    }
                    el.append(sliceAppend).prepend(slicePrepend);
                }
                // remove the loading DOM element
                slider.loader.remove();
                // set the left / top position of "el"
                setSlidePosition();
                // if "vertical" mode, always use adaptiveHeight to prevent odd behavior
                if (slider.settings.mode === 'vertical') { slider.settings.adaptiveHeight = true; }
                // set the viewport height
                slider.viewport.height(getViewportHeight());
                // make sure everything is positioned just right (same as a window resize)
                el.redrawSlider();
                // onSliderLoad callback
                slider.settings.onSliderLoad.call(el, slider.active.index);
                // slider has been fully initialized
                slider.initialized = true;
                // add the resize call to the window
                if (slider.settings.responsive) { $(window).on('resize', resizeWindow); }
                // if auto is true and has more than 1 page, start the show
                if (slider.settings.auto && slider.settings.autoStart && (getPagerQty() > 1 || slider.settings.autoSlideForOnePage)) { initAuto(); }
                // if ticker is true, start the ticker
                if (slider.settings.ticker) { initTicker(); }
                // if pager is requested, make the appropriate pager link active
                if (slider.settings.pager) { updatePagerActive(slider.settings.startSlide); }
                // check for any updates to the controls (like hideControlOnEnd updates)
                if (slider.settings.controls) { updateDirectionControls(); }
                // if touchEnabled is true, setup the touch events
                if (slider.settings.touchEnabled && !slider.settings.ticker) { initTouch(); }
                // if keyboardEnabled is true, setup the keyboard events
                if (slider.settings.keyboardEnabled && !slider.settings.ticker) {
                    $(document).keydown(keyPress);
                }
            };

            /**
             * Returns the calculated height of the viewport, used to determine either adaptiveHeight or the maxHeight value
             */
            var getViewportHeight = function() {
                var height = 0;
                // first determine which children (slides) should be used in our height calculation
                var children = $();
                // if mode is not "vertical" and adaptiveHeight is false, include all children
                if (slider.settings.mode !== 'vertical' && !slider.settings.adaptiveHeight) {
                    children = slider.children;
                } else {
                    // if not carousel, return the single active child
                    if (!slider.carousel) {
                        children = slider.children.eq(slider.active.index);
                        // if carousel, return a slice of children
                    } else {
                        // get the individual slide index
                        var currentIndex = slider.settings.moveSlides === 1 ? slider.active.index : slider.active.index * getMoveBy();
                        // add the current slide to the children
                        children = slider.children.eq(currentIndex);
                        // cycle through the remaining "showing" slides
                        for (i = 1; i <= slider.settings.maxSlides - 1; i++) {
                            // if looped back to the start
                            if (currentIndex + i >= slider.children.length) {
                                children = children.add(slider.children.eq(i - 1));
                            } else {
                                children = children.add(slider.children.eq(currentIndex + i));
                            }
                        }
                    }
                }
                // if "vertical" mode, calculate the sum of the heights of the children
                if (slider.settings.mode === 'vertical') {
                    children.each(function(index) {
                        height += $(this).outerHeight();
                    });
                    // add user-supplied margins
                    if (slider.settings.slideMargin > 0) {
                        height += slider.settings.slideMargin * (slider.settings.minSlides - 1);
                    }
                    // if not "vertical" mode, calculate the max height of the children
                } else {
                    height = Math.max.apply(Math, children.map(function() {
                        return $(this).outerHeight(false);
                    }).get());
                }

                if (slider.viewport.css('box-sizing') === 'border-box') {
                    height += parseFloat(slider.viewport.css('padding-top')) + parseFloat(slider.viewport.css('padding-bottom')) +
                        parseFloat(slider.viewport.css('border-top-width')) + parseFloat(slider.viewport.css('border-bottom-width'));
                } else if (slider.viewport.css('box-sizing') === 'padding-box') {
                    height += parseFloat(slider.viewport.css('padding-top')) + parseFloat(slider.viewport.css('padding-bottom'));
                }

                return height;
            };

            /**
             * Returns the calculated width to be used for the outer wrapper / viewport
             */
            var getViewportMaxWidth = function() {
                var width = '100%';
                if (slider.settings.slideWidth > 0) {
                    if (slider.settings.mode === 'horizontal') {
                        width = (slider.settings.maxSlides * slider.settings.slideWidth) + ((slider.settings.maxSlides - 1) * slider.settings.slideMargin);
                    } else {
                        width = slider.settings.slideWidth;
                    }
                }
                return width;
            };

            /**
             * Returns the calculated width to be applied to each slide
             */
            var getSlideWidth = function() {
                var newElWidth = slider.settings.slideWidth, // start with any user-supplied slide width
                    wrapWidth      = slider.viewport.width();    // get the current viewport width
                // if slide width was not supplied, or is larger than the viewport use the viewport width
                if (slider.settings.slideWidth === 0 ||
                    (slider.settings.slideWidth > wrapWidth && !slider.carousel) ||
                    slider.settings.mode === 'vertical') {
                    newElWidth = wrapWidth;
                    // if carousel, use the thresholds to determine the width
                } else if (slider.settings.maxSlides > 1 && slider.settings.mode === 'horizontal') {
                    if (wrapWidth > slider.maxThreshold) {
                        return newElWidth;
                    } else if (wrapWidth < slider.minThreshold) {
                        newElWidth = (wrapWidth - (slider.settings.slideMargin * (slider.settings.minSlides - 1))) / slider.settings.minSlides;
                    } else if (slider.settings.shrinkItems) {
                        newElWidth = Math.floor((wrapWidth + slider.settings.slideMargin) / (Math.ceil((wrapWidth + slider.settings.slideMargin) / (newElWidth + slider.settings.slideMargin))) - slider.settings.slideMargin);
                    }
                }
                return newElWidth;
            };

            /**
             * Returns the number of slides currently visible in the viewport (includes partially visible slides)
             */
            var getNumberSlidesShowing = function() {
                var slidesShowing = 1,
                    childWidth = null;
                if (slider.settings.mode === 'horizontal' && slider.settings.slideWidth > 0) {
                    // if viewport is smaller than minThreshold, return minSlides
                    if (slider.viewport.width() < slider.minThreshold) {
                        slidesShowing = slider.settings.minSlides;
                        // if viewport is larger than maxThreshold, return maxSlides
                    } else if (slider.viewport.width() > slider.maxThreshold) {
                        slidesShowing = slider.settings.maxSlides;
                        // if viewport is between min / max thresholds, divide viewport width by first child width
                    } else {
                        childWidth = slider.children.first().width() + slider.settings.slideMargin;
                        slidesShowing = Math.floor((slider.viewport.width() +
                            slider.settings.slideMargin) / childWidth) || 1;
                    }
                    // if "vertical" mode, slides showing will always be minSlides
                } else if (slider.settings.mode === 'vertical') {
                    slidesShowing = slider.settings.minSlides;
                }
                return slidesShowing;
            };

            /**
             * Returns the number of pages (one full viewport of slides is one "page")
             */
            var getPagerQty = function() {
                var pagerQty = 0,
                    breakPoint = 0,
                    counter = 0;
                // if moveSlides is specified by the user
                if (slider.settings.moveSlides > 0) {
                    if (slider.settings.infiniteLoop) {
                        pagerQty = Math.ceil(slider.children.length / getMoveBy());
                    } else {
                        // when breakpoint goes above children length, counter is the number of pages
                        while (breakPoint < slider.children.length) {
                            ++pagerQty;
                            breakPoint = counter + getNumberSlidesShowing();
                            counter += slider.settings.moveSlides <= getNumberSlidesShowing() ? slider.settings.moveSlides : getNumberSlidesShowing();
                        }
                        return counter;
                    }
                    // if moveSlides is 0 (auto) divide children length by sides showing, then round up
                } else {
                    pagerQty = Math.ceil(slider.children.length / getNumberSlidesShowing());
                }
                return pagerQty;
            };

            /**
             * Returns the number of individual slides by which to shift the slider
             */
            var getMoveBy = function() {
                // if moveSlides was set by the user and moveSlides is less than number of slides showing
                if (slider.settings.moveSlides > 0 && slider.settings.moveSlides <= getNumberSlidesShowing()) {
                    return slider.settings.moveSlides;
                }
                // if moveSlides is 0 (auto)
                return getNumberSlidesShowing();
            };

            /**
             * Sets the slider's (el) left or top position
             */
            var setSlidePosition = function() {
                var position, lastChild, lastShowingIndex;
                // if last slide, not infinite loop, and number of children is larger than specified maxSlides
                if (slider.children.length > slider.settings.maxSlides && slider.active.last && !slider.settings.infiniteLoop) {
                    if (slider.settings.mode === 'horizontal') {
                        // get the last child's position
                        lastChild = slider.children.last();
                        position = lastChild.position();
                        // set the left position
                        setPositionProperty(-(position.left - (slider.viewport.width() - lastChild.outerWidth())), 'reset', 0);
                    } else if (slider.settings.mode === 'vertical') {
                        // get the last showing index's position
                        lastShowingIndex = slider.children.length - slider.settings.minSlides;
                        position = slider.children.eq(lastShowingIndex).position();
                        // set the top position
                        setPositionProperty(-position.top, 'reset', 0);
                    }
                    // if not last slide
                } else {
                    // get the position of the first showing slide
                    position = slider.children.eq(slider.active.index * getMoveBy()).position();
                    // check for last slide
                    if (slider.active.index === getPagerQty() - 1) { slider.active.last = true; }
                    // set the respective position
                    if (position !== undefined) {
                        if (slider.settings.mode === 'horizontal') { setPositionProperty(-position.left, 'reset', 0); }
                        else if (slider.settings.mode === 'vertical') { setPositionProperty(-position.top, 'reset', 0); }
                    }
                }
            };

            /**
             * Sets the el's animating property position (which in turn will sometimes animate el).
             * If using CSS, sets the transform property. If not using CSS, sets the top / left property.
             *
             * @param value (int)
             *  - the animating property's value
             *
             * @param type (string) 'slide', 'reset', 'ticker'
             *  - the type of instance for which the function is being
             *
             * @param duration (int)
             *  - the amount of time (in ms) the transition should occupy
             *
             * @param params (array) optional
             *  - an optional parameter containing any variables that need to be passed in
             */
            var setPositionProperty = function(value, type, duration, params) {
                var animateObj, propValue;
                // use CSS transform
                if (slider.usingCSS) {
                    // determine the translate3d value
                    propValue = slider.settings.mode === 'vertical' ? 'translate3d(0, ' + value + 'px, 0)' : 'translate3d(' + value + 'px, 0, 0)';
                    // add the CSS transition-duration
                    el.css('-' + slider.cssPrefix + '-transition-duration', duration / 1000 + 's');
                    if (type === 'slide') {
                        // set the property value
                        el.css(slider.animProp, propValue);
                        if (duration !== 0) {
                            // add a callback method - executes when CSS transition completes
                            el.on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function(e) {
                                //make sure it's the correct one
                                if (!$(e.target).is(el)) { return; }
                                // remove the callback
                                el.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
                                updateAfterSlideTransition();
                            });
                        } else { //duration = 0
                            updateAfterSlideTransition();
                        }
                    } else if (type === 'reset') {
                        el.css(slider.animProp, propValue);
                    } else if (type === 'ticker') {
                        // make the transition use 'linear'
                        el.css('-' + slider.cssPrefix + '-transition-timing-function', 'linear');
                        el.css(slider.animProp, propValue);
                        if (duration !== 0) {
                            el.on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function(e) {
                                //make sure it's the correct one
                                if (!$(e.target).is(el)) { return; }
                                // remove the callback
                                el.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
                                // reset the position
                                setPositionProperty(params.resetValue, 'reset', 0);
                                // start the loop again
                                tickerLoop();
                            });
                        } else { //duration = 0
                            setPositionProperty(params.resetValue, 'reset', 0);
                            tickerLoop();
                        }
                    }
                    // use JS animate
                } else {
                    animateObj = {};
                    animateObj[slider.animProp] = value;
                    if (type === 'slide') {
                        el.animate(animateObj, duration, slider.settings.easing, function() {
                            updateAfterSlideTransition();
                        });
                    } else if (type === 'reset') {
                        el.css(slider.animProp, value);
                    } else if (type === 'ticker') {
                        el.animate(animateObj, duration, 'linear', function() {
                            setPositionProperty(params.resetValue, 'reset', 0);
                            // run the recursive loop after animation
                            tickerLoop();
                        });
                    }
                }
            };

            /**
             * Populates the pager with proper amount of pages
             */
            var populatePager = function() {
                var pagerHtml = '',
                    linkContent = '',
                    pagerQty = getPagerQty();
                // loop through each pager item
                for (var i = 0; i < pagerQty; i++) {
                    linkContent = '';
                    // if a buildPager function is supplied, use it to get pager link value, else use index + 1
                    if (slider.settings.buildPager && $.isFunction(slider.settings.buildPager) || slider.settings.pagerCustom) {
                        linkContent = slider.settings.buildPager(i);
                        slider.pagerEl.addClass('bx-custom-pager');
                    } else {
                        linkContent = i + 1;
                        slider.pagerEl.addClass('bx-default-pager');
                    }
                    // var linkContent = slider.settings.buildPager && $.isFunction(slider.settings.buildPager) ? slider.settings.buildPager(i) : i + 1;
                    // add the markup to the string
                    pagerHtml += '<div class="bx-pager-item"><a href="" data-slide-index="' + i + '" class="bx-pager-link">' + linkContent + '</a></div>';
                }
                // populate the pager element with pager links
                slider.pagerEl.html(pagerHtml);
            };

            /**
             * Appends the pager to the controls element
             */
            var appendPager = function() {
                if (!slider.settings.pagerCustom) {
                    // create the pager DOM element
                    slider.pagerEl = $('<div class="bx-pager" />');
                    // if a pager selector was supplied, populate it with the pager
                    if (slider.settings.pagerSelector) {
                        $(slider.settings.pagerSelector).html(slider.pagerEl);
                        // if no pager selector was supplied, add it after the wrapper
                    } else {
                        slider.controls.el.addClass('bx-has-pager').append(slider.pagerEl);
                    }
                    // populate the pager
                    populatePager();
                } else {
                    slider.pagerEl = $(slider.settings.pagerCustom);
                }
                // assign the pager click binding
                slider.pagerEl.on('click touchend', 'a', clickPagerBind);
            };

            /**
             * Appends prev / next controls to the controls element
             */
            var appendControls = function() {
                slider.controls.next = $('<a class="bx-next" href="">' + slider.settings.nextText + '</a>');
                slider.controls.prev = $('<a class="bx-prev" href="">' + slider.settings.prevText + '</a>');
                // add click actions to the controls
                slider.controls.next.on('click touchend', clickNextBind);
                slider.controls.prev.on('click touchend', clickPrevBind);
                // if nextSelector was supplied, populate it
                if (slider.settings.nextSelector) {
                    $(slider.settings.nextSelector).append(slider.controls.next);
                }
                // if prevSelector was supplied, populate it
                if (slider.settings.prevSelector) {
                    $(slider.settings.prevSelector).append(slider.controls.prev);
                }
                // if no custom selectors were supplied
                if (!slider.settings.nextSelector && !slider.settings.prevSelector) {
                    // add the controls to the DOM
                    slider.controls.directionEl = $('<div class="bx-controls-direction" />');
                    // add the control elements to the directionEl
                    slider.controls.directionEl.append(slider.controls.prev).append(slider.controls.next);
                    // slider.viewport.append(slider.controls.directionEl);
                    slider.controls.el.addClass('bx-has-controls-direction').append(slider.controls.directionEl);
                }
            };

            /**
             * Appends start / stop auto controls to the controls element
             */
            var appendControlsAuto = function() {
                slider.controls.start = $('<div class="bx-controls-auto-item"><a class="bx-start" href="">' + slider.settings.startText + '</a></div>');
                slider.controls.stop = $('<div class="bx-controls-auto-item"><a class="bx-stop" href="">' + slider.settings.stopText + '</a></div>');
                // add the controls to the DOM
                slider.controls.autoEl = $('<div class="bx-controls-auto" />');
                // on click actions to the controls
                slider.controls.autoEl.on('click', '.bx-start', clickStartBind);
                slider.controls.autoEl.on('click', '.bx-stop', clickStopBind);
                // if autoControlsCombine, insert only the "start" control
                if (slider.settings.autoControlsCombine) {
                    slider.controls.autoEl.append(slider.controls.start);
                    // if autoControlsCombine is false, insert both controls
                } else {
                    slider.controls.autoEl.append(slider.controls.start).append(slider.controls.stop);
                }
                // if auto controls selector was supplied, populate it with the controls
                if (slider.settings.autoControlsSelector) {
                    $(slider.settings.autoControlsSelector).html(slider.controls.autoEl);
                    // if auto controls selector was not supplied, add it after the wrapper
                } else {
                    slider.controls.el.addClass('bx-has-controls-auto').append(slider.controls.autoEl);
                }
                // update the auto controls
                updateAutoControls(slider.settings.autoStart ? 'stop' : 'start');
            };

            /**
             * Appends image captions to the DOM
             */
            var appendCaptions = function() {
                // cycle through each child
                slider.children.each(function(index) {
                    // get the image title attribute
                    var title = $(this).find('img:first').attr('title');
                    // append the caption
                    if (title !== undefined && ('' + title).length) {
                        $(this).append('<div class="bx-caption"><span>' + title + '</span></div>');
                    }
                });
            };

            /**
             * Click next binding
             *
             * @param e (event)
             *  - DOM event object
             */
            var clickNextBind = function(e) {
                e.preventDefault();
                if (slider.controls.el.hasClass('disabled')) { return; }
                // if auto show is running, stop it
                if (slider.settings.auto && slider.settings.stopAutoOnClick) { el.stopAuto(); }
                el.goToNextSlide();
            };

            /**
             * Click prev binding
             *
             * @param e (event)
             *  - DOM event object
             */
            var clickPrevBind = function(e) {
                e.preventDefault();
                if (slider.controls.el.hasClass('disabled')) { return; }
                // if auto show is running, stop it
                if (slider.settings.auto && slider.settings.stopAutoOnClick) { el.stopAuto(); }
                el.goToPrevSlide();
            };

            /**
             * Click start binding
             *
             * @param e (event)
             *  - DOM event object
             */
            var clickStartBind = function(e) {
                el.startAuto();
                e.preventDefault();
            };

            /**
             * Click stop binding
             *
             * @param e (event)
             *  - DOM event object
             */
            var clickStopBind = function(e) {
                el.stopAuto();
                e.preventDefault();
            };

            /**
             * Click pager binding
             *
             * @param e (event)
             *  - DOM event object
             */
            var clickPagerBind = function(e) {
                var pagerLink, pagerIndex;
                e.preventDefault();
                if (slider.controls.el.hasClass('disabled')) {
                    return;
                }
                // if auto show is running, stop it
                if (slider.settings.auto  && slider.settings.stopAutoOnClick) { el.stopAuto(); }
                pagerLink = $(e.currentTarget);
                if (pagerLink.attr('data-slide-index') !== undefined) {
                    pagerIndex = parseInt(pagerLink.attr('data-slide-index'));
                    // if clicked pager link is not active, continue with the goToSlide call
                    if (pagerIndex !== slider.active.index) { el.goToSlide(pagerIndex); }
                }
            };

            /**
             * Updates the pager links with an active class
             *
             * @param slideIndex (int)
             *  - index of slide to make active
             */
            var updatePagerActive = function(slideIndex) {
                // if "short" pager type
                var len = slider.children.length; // nb of children
                if (slider.settings.pagerType === 'short') {
                    if (slider.settings.maxSlides > 1) {
                        len = Math.ceil(slider.children.length / slider.settings.maxSlides);
                    }
                    slider.pagerEl.html((slideIndex + 1) + slider.settings.pagerShortSeparator + len);
                    return;
                }
                // remove all pager active classes
                slider.pagerEl.find('a').removeClass('active');
                // apply the active class for all pagers
                slider.pagerEl.each(function(i, el) { $(el).find('a').eq(slideIndex).addClass('active'); });
            };

            /**
             * Performs needed actions after a slide transition
             */
            var updateAfterSlideTransition = function() {
                // if infinite loop is true
                if (slider.settings.infiniteLoop) {
                    var position = '';
                    // first slide
                    if (slider.active.index === 0) {
                        // set the new position
                        position = slider.children.eq(0).position();
                        // carousel, last slide
                    } else if (slider.active.index === getPagerQty() - 1 && slider.carousel) {
                        position = slider.children.eq((getPagerQty() - 1) * getMoveBy()).position();
                        // last slide
                    } else if (slider.active.index === slider.children.length - 1) {
                        position = slider.children.eq(slider.children.length - 1).position();
                    }
                    if (position) {
                        if (slider.settings.mode === 'horizontal') { setPositionProperty(-position.left, 'reset', 0); }
                        else if (slider.settings.mode === 'vertical') { setPositionProperty(-position.top, 'reset', 0); }
                    }
                }
                // declare that the transition is complete
                slider.working = false;
                // onSlideAfter callback
                slider.settings.onSlideAfter.call(el, slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);
            };

            /**
             * Updates the auto controls state (either active, or combined switch)
             *
             * @param state (string) "start", "stop"
             *  - the new state of the auto show
             */
            var updateAutoControls = function(state) {
                // if autoControlsCombine is true, replace the current control with the new state
                if (slider.settings.autoControlsCombine) {
                    slider.controls.autoEl.html(slider.controls[state]);
                    // if autoControlsCombine is false, apply the "active" class to the appropriate control
                } else {
                    slider.controls.autoEl.find('a').removeClass('active');
                    slider.controls.autoEl.find('a:not(.bx-' + state + ')').addClass('active');
                }
            };

            /**
             * Updates the direction controls (checks if either should be hidden)
             */
            var updateDirectionControls = function() {
                if (getPagerQty() === 1) {
                    slider.controls.prev.addClass('disabled');
                    slider.controls.next.addClass('disabled');
                } else if (!slider.settings.infiniteLoop && slider.settings.hideControlOnEnd) {
                    // if first slide
                    if (slider.active.index === 0) {
                        slider.controls.prev.addClass('disabled');
                        slider.controls.next.removeClass('disabled');
                        // if last slide
                    } else if (slider.active.index === getPagerQty() - 1) {
                        slider.controls.next.addClass('disabled');
                        slider.controls.prev.removeClass('disabled');
                        // if any slide in the middle
                    } else {
                        slider.controls.prev.removeClass('disabled');
                        slider.controls.next.removeClass('disabled');
                    }
                }
            };
            /* auto start and stop functions */
            var windowFocusHandler = function() { el.startAuto(); };
            var windowBlurHandler = function() { el.stopAuto(); };
            /**
             * Initializes the auto process
             */
            var initAuto = function() {
                // if autoDelay was supplied, launch the auto show using a setTimeout() call
                if (slider.settings.autoDelay > 0) {
                    setTimeout(el.startAuto, slider.settings.autoDelay);
                    // if autoDelay was not supplied, start the auto show normally
                } else {
                    el.startAuto();

                    //add focus and blur events to ensure its running if timeout gets paused
                    $(window).focus(windowFocusHandler).blur(windowBlurHandler);
                }
                // if autoHover is requested
                if (slider.settings.autoHover) {
                    // on el hover
                    el.hover(function() {
                        // if the auto show is currently playing (has an active interval)
                        if (slider.interval) {
                            // stop the auto show and pass true argument which will prevent control update
                            el.stopAuto(true);
                            // create a new autoPaused value which will be used by the relative "mouseout" event
                            slider.autoPaused = true;
                        }
                    }, function() {
                        // if the autoPaused value was created be the prior "mouseover" event
                        if (slider.autoPaused) {
                            // start the auto show and pass true argument which will prevent control update
                            el.startAuto(true);
                            // reset the autoPaused value
                            slider.autoPaused = null;
                        }
                    });
                }
            };

            /**
             * Initializes the ticker process
             */
            var initTicker = function() {
                var startPosition = 0,
                    position, transform, value, idx, ratio, property, newSpeed, totalDimens;
                // if autoDirection is "next", append a clone of the entire slider
                if (slider.settings.autoDirection === 'next') {
                    el.append(slider.children.clone().addClass('bx-clone'));
                    // if autoDirection is "prev", prepend a clone of the entire slider, and set the left position
                } else {
                    el.prepend(slider.children.clone().addClass('bx-clone'));
                    position = slider.children.first().position();
                    startPosition = slider.settings.mode === 'horizontal' ? -position.left : -position.top;
                }
                setPositionProperty(startPosition, 'reset', 0);
                // do not allow controls in ticker mode
                slider.settings.pager = false;
                slider.settings.controls = false;
                slider.settings.autoControls = false;
                // if autoHover is requested
                if (slider.settings.tickerHover) {
                    if (slider.usingCSS) {
                        idx = slider.settings.mode === 'horizontal' ? 4 : 5;
                        slider.viewport.hover(function() {
                            transform = el.css('-' + slider.cssPrefix + '-transform');
                            value = parseFloat(transform.split(',')[idx]);
                            setPositionProperty(value, 'reset', 0);
                        }, function() {
                            totalDimens = 0;
                            slider.children.each(function(index) {
                                totalDimens += slider.settings.mode === 'horizontal' ? $(this).outerWidth(true) : $(this).outerHeight(true);
                            });
                            // calculate the speed ratio (used to determine the new speed to finish the paused animation)
                            ratio = slider.settings.speed / totalDimens;
                            // determine which property to use
                            property = slider.settings.mode === 'horizontal' ? 'left' : 'top';
                            // calculate the new speed
                            newSpeed = ratio * (totalDimens - (Math.abs(parseInt(value))));
                            tickerLoop(newSpeed);
                        });
                    } else {
                        // on el hover
                        slider.viewport.hover(function() {
                            el.stop();
                        }, function() {
                            // calculate the total width of children (used to calculate the speed ratio)
                            totalDimens = 0;
                            slider.children.each(function(index) {
                                totalDimens += slider.settings.mode === 'horizontal' ? $(this).outerWidth(true) : $(this).outerHeight(true);
                            });
                            // calculate the speed ratio (used to determine the new speed to finish the paused animation)
                            ratio = slider.settings.speed / totalDimens;
                            // determine which property to use
                            property = slider.settings.mode === 'horizontal' ? 'left' : 'top';
                            // calculate the new speed
                            newSpeed = ratio * (totalDimens - (Math.abs(parseInt(el.css(property)))));
                            tickerLoop(newSpeed);
                        });
                    }
                }
                // start the ticker loop
                tickerLoop();
            };

            /**
             * Runs a continuous loop, news ticker-style
             */
            var tickerLoop = function(resumeSpeed) {
                var speed = resumeSpeed ? resumeSpeed : slider.settings.speed,
                    position = {left: 0, top: 0},
                    reset = {left: 0, top: 0},
                    animateProperty, resetValue, params;

                // if "next" animate left position to last child, then reset left to 0
                if (slider.settings.autoDirection === 'next') {
                    position = el.find('.bx-clone').first().position();
                    // if "prev" animate left position to 0, then reset left to first non-clone child
                } else {
                    reset = slider.children.first().position();
                }
                animateProperty = slider.settings.mode === 'horizontal' ? -position.left : -position.top;
                resetValue = slider.settings.mode === 'horizontal' ? -reset.left : -reset.top;
                params = {resetValue: resetValue};
                setPositionProperty(animateProperty, 'ticker', speed, params);
            };

            /**
             * Check if el is on screen
             */
            var isOnScreen = function(el) {
                var win = $(window),
                    viewport = {
                        top: win.scrollTop(),
                        left: win.scrollLeft()
                    },
                    bounds = el.offset();

                viewport.right = viewport.left + win.width();
                viewport.bottom = viewport.top + win.height();
                bounds.right = bounds.left + el.outerWidth();
                bounds.bottom = bounds.top + el.outerHeight();

                return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));
            };

            /**
             * Initializes keyboard events
             */
            var keyPress = function(e) {
                var activeElementTag = document.activeElement.tagName.toLowerCase(),
                    tagFilters = 'input|textarea',
                    p = new RegExp(activeElementTag,['i']),
                    result = p.exec(tagFilters);

                if (result == null && isOnScreen(el)) {
                    if (e.keyCode === 39) {
                        clickNextBind(e);
                        return false;
                    } else if (e.keyCode === 37) {
                        clickPrevBind(e);
                        return false;
                    }
                }
            };

            /**
             * Initializes touch events
             */
            var initTouch = function() {
                // initialize object to contain all touch values
                slider.touch = {
                    start: {x: 0, y: 0},
                    end: {x: 0, y: 0}
                };
                slider.viewport.on('touchstart MSPointerDown pointerdown', onTouchStart);

                //for browsers that have implemented pointer events and fire a click after
                //every pointerup regardless of whether pointerup is on same screen location as pointerdown or not
                slider.viewport.on('click', '.bxslider a', function(e) {
                    if (slider.viewport.hasClass('click-disabled')) {
                        e.preventDefault();
                        slider.viewport.removeClass('click-disabled');
                    }
                });
            };

            /**
             * Event handler for "touchstart"
             *
             * @param e (event)
             *  - DOM event object
             */
            var onTouchStart = function(e) {
                // watch only for left mouse, touch contact and pen contact
                // touchstart event object doesn`t have button property
                if (e.type !== 'touchstart' && e.button !== 0) {
                    return;
                }

                // !!! We don't want to prevent default handler to be able to scroll vertically in mobile devices and to select text !!!
                //e.preventDefault();

                //disable slider controls while user is interacting with slides to avoid slider freeze that happens on touch devices when a slide swipe happens immediately after interacting with slider controls
                slider.controls.el.addClass('disabled');

                if (slider.working) {
                    slider.controls.el.removeClass('disabled');
                } else {
                    // record the original position when touch starts
                    slider.touch.originalPos = el.position();
                    var orig = e.originalEvent,
                        touchPoints = (typeof orig.changedTouches !== 'undefined') ? orig.changedTouches : [orig];
                    var chromePointerEvents = typeof PointerEvent === 'function';
                    if (chromePointerEvents) {
                        if (orig.pointerId === undefined) {
                            return;
                        }
                    }
                    // record the starting touch x, y coordinates
                    slider.touch.start.x = touchPoints[0].pageX;
                    slider.touch.start.y = touchPoints[0].pageY;

                    if (slider.viewport.get(0).setPointerCapture) {
                        slider.pointerId = orig.pointerId;
                        slider.viewport.get(0).setPointerCapture(slider.pointerId);
                    }
                    // store original event data for click fixation
                    slider.originalClickTarget = orig.originalTarget || orig.target;
                    slider.originalClickButton = orig.button;
                    slider.originalClickButtons = orig.buttons;
                    slider.originalEventType = orig.type;
                    // at this moment we don`t know what it is click or swipe
                    slider.hasMove = false;
                    // on a "touchmove" event to the viewport
                    slider.viewport.on('touchmove MSPointerMove pointermove', onTouchMove);
                    // on a "touchend" event to the viewport
                    slider.viewport.on('touchend MSPointerUp pointerup', onTouchEnd);
                    slider.viewport.on('MSPointerCancel pointercancel', onPointerCancel);
                }
            };

            /**
             * Cancel Pointer for Windows Phone
             *
             * @param e (event)
             *  - DOM event object
             */
            var onPointerCancel = function(e) {
                e.preventDefault();
                /* onPointerCancel handler is needed to deal with situations when a touchend
                doesn't fire after a touchstart (this happens on windows phones only) */
                setPositionProperty(slider.touch.originalPos.left, 'reset', 0);

                //remove handlers
                slider.controls.el.removeClass('disabled');
                slider.viewport.off('MSPointerCancel pointercancel', onPointerCancel);
                slider.viewport.off('touchmove MSPointerMove pointermove', onTouchMove);
                slider.viewport.off('touchend MSPointerUp pointerup', onTouchEnd);
                if (slider.viewport.get(0).releasePointerCapture) {
                    slider.viewport.get(0).releasePointerCapture(slider.pointerId);
                }
            };

            /**
             * Event handler for "touchmove"
             *
             * @param e (event)
             *  - DOM event object
             */
            var onTouchMove = function(e) {
                var orig = e.originalEvent,
                    touchPoints = (typeof orig.changedTouches !== 'undefined') ? orig.changedTouches : [orig],
                    // if scrolling on y axis, do not prevent default
                    xMovement = Math.abs(touchPoints[0].pageX - slider.touch.start.x),
                    yMovement = Math.abs(touchPoints[0].pageY - slider.touch.start.y),
                    value = 0,
                    change = 0;
                // this is swipe
                slider.hasMove = true;

                // x axis swipe
                if ((xMovement * 3) > yMovement && slider.settings.preventDefaultSwipeX) {
                    e.preventDefault();
                    // y axis swipe
                } else if ((yMovement * 3) > xMovement && slider.settings.preventDefaultSwipeY) {
                    e.preventDefault();
                }
                if (e.type !== 'touchmove') {
                    e.preventDefault();
                }

                if (slider.settings.mode !== 'fade' && slider.settings.oneToOneTouch) {
                    // if horizontal, drag along x axis
                    if (slider.settings.mode === 'horizontal') {
                        change = touchPoints[0].pageX - slider.touch.start.x;
                        value = slider.touch.originalPos.left + change;
                        // if vertical, drag along y axis
                    } else {
                        change = touchPoints[0].pageY - slider.touch.start.y;
                        value = slider.touch.originalPos.top + change;
                    }
                    setPositionProperty(value, 'reset', 0);
                }
            };

            /**
             * Event handler for "touchend"
             *
             * @param e (event)
             *  - DOM event object
             */
            var onTouchEnd = function(e) {
                e.preventDefault();
                slider.viewport.off('touchmove MSPointerMove pointermove', onTouchMove);
                //enable slider controls as soon as user stops interacing with slides
                slider.controls.el.removeClass('disabled');
                var orig    = e.originalEvent,
                    touchPoints = (typeof orig.changedTouches !== 'undefined') ? orig.changedTouches : [orig],
                    value       = 0,
                    distance    = 0;
                // record end x, y positions
                slider.touch.end.x = touchPoints[0].pageX;
                slider.touch.end.y = touchPoints[0].pageY;
                // if fade mode, check if absolute x distance clears the threshold
                if (slider.settings.mode === 'fade') {
                    distance = Math.abs(slider.touch.start.x - slider.touch.end.x);
                    if (distance >= slider.settings.swipeThreshold) {
                        if (slider.touch.start.x > slider.touch.end.x) {
                            el.goToNextSlide();
                        } else {
                            el.goToPrevSlide();
                        }
                        el.stopAuto();
                    }
                    // not fade mode
                } else {
                    // calculate distance and el's animate property
                    if (slider.settings.mode === 'horizontal') {
                        distance = slider.touch.end.x - slider.touch.start.x;
                        value = slider.touch.originalPos.left;
                    } else {
                        distance = slider.touch.end.y - slider.touch.start.y;
                        value = slider.touch.originalPos.top;
                    }
                    // if not infinite loop and first / last slide, do not attempt a slide transition
                    if (!slider.settings.infiniteLoop && ((slider.active.index === 0 && distance > 0) || (slider.active.last && distance < 0))) {
                        setPositionProperty(value, 'reset', 200);
                    } else {
                        // check if distance clears threshold
                        if (Math.abs(distance) >= slider.settings.swipeThreshold) {
                            if (distance < 0) {
                                el.goToNextSlide();
                            } else {
                                el.goToPrevSlide();
                            }
                            el.stopAuto();
                        } else {
                            // el.animate(property, 200);
                            setPositionProperty(value, 'reset', 200);
                        }
                    }
                }
                slider.viewport.off('touchend MSPointerUp pointerup', onTouchEnd);

                if (slider.viewport.get(0).releasePointerCapture) {
                    slider.viewport.get(0).releasePointerCapture(slider.pointerId);
                }
                // if slider had swipe with left mouse, touch contact and pen contact
                if (slider.hasMove === false && (slider.originalClickButton === 0 || slider.originalEventType === 'touchstart')) {
                    // trigger click event (fix for Firefox59 and PointerEvent standard compatibility)
                    $(slider.originalClickTarget).trigger({
                        type: 'click',
                        button: slider.originalClickButton,
                        buttons: slider.originalClickButtons
                    });
                }
            };

            /**
             * Window resize event callback
             */
            var resizeWindow = function(e) {
                // don't do anything if slider isn't initialized.
                if (!slider.initialized) { return; }
                // Delay if slider working.
                if (slider.working) {
                    window.setTimeout(resizeWindow, 10);
                } else {
                    // get the new window dimens (again, thank you IE)
                    var windowWidthNew = $(window).width(),
                        windowHeightNew = $(window).height();
                    // make sure that it is a true window resize
                    // *we must check this because our dinosaur friend IE fires a window resize event when certain DOM elements
                    // are resized. Can you just die already?*
                    if (windowWidth !== windowWidthNew || windowHeight !== windowHeightNew) {
                        // set the new window dimens
                        windowWidth = windowWidthNew;
                        windowHeight = windowHeightNew;
                        // update all dynamic elements
                        el.redrawSlider();
                        // Call user resize handler
                        slider.settings.onSliderResize.call(el, slider.active.index);
                    }
                }
            };

            /**
             * Adds an aria-hidden=true attribute to each element
             *
             * @param startVisibleIndex (int)
             *  - the first visible element's index
             */
            var applyAriaHiddenAttributes = function(startVisibleIndex) {
                var numberOfSlidesShowing = getNumberSlidesShowing();
                // only apply attributes if the setting is enabled and not in ticker mode
                if (slider.settings.ariaHidden && !slider.settings.ticker) {
                    // add aria-hidden=true to all elements
                    slider.children.attr('aria-hidden', 'true');
                    // get the visible elements and change to aria-hidden=false
                    slider.children.slice(startVisibleIndex, startVisibleIndex + numberOfSlidesShowing).attr('aria-hidden', 'false');
                }
            };

            /**
             * Returns index according to present page range
             *
             * @param slideOndex (int)
             *  - the desired slide index
             */
            var setSlideIndex = function(slideIndex) {
                if (slideIndex < 0) {
                    if (slider.settings.infiniteLoop) {
                        return getPagerQty() - 1;
                    }else {
                        //we don't go to undefined slides
                        return slider.active.index;
                    }
                    // if slideIndex is greater than children length, set active index to 0 (this happens during infinite loop)
                } else if (slideIndex >= getPagerQty()) {
                    if (slider.settings.infiniteLoop) {
                        return 0;
                    } else {
                        //we don't move to undefined pages
                        return slider.active.index;
                    }
                    // set active index to requested slide
                } else {
                    return slideIndex;
                }
            };

            /**
             * ===================================================================================
             * = PUBLIC FUNCTIONS
             * ===================================================================================
             */

            /**
             * Performs slide transition to the specified slide
             *
             * @param slideIndex (int)
             *  - the destination slide's index (zero-based)
             *
             * @param direction (string)
             *  - INTERNAL USE ONLY - the direction of travel ("prev" / "next")
             */
            el.goToSlide = function(slideIndex, direction) {
                // onSlideBefore, onSlideNext, onSlidePrev callbacks
                // Allow transition canceling based on returned value
                var performTransition = true,
                    moveBy = 0,
                    position = {left: 0, top: 0},
                    lastChild = null,
                    lastShowingIndex, eq, value, requestEl;
                // store the old index
                slider.oldIndex = slider.active.index;
                //set new index
                slider.active.index = setSlideIndex(slideIndex);

                // if plugin is currently in motion, ignore request
                if (slider.working || slider.active.index === slider.oldIndex) { return; }
                // declare that plugin is in motion
                slider.working = true;

                performTransition = slider.settings.onSlideBefore.call(el, slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);

                // If transitions canceled, reset and return
                if (typeof (performTransition) !== 'undefined' && !performTransition) {
                    slider.active.index = slider.oldIndex; // restore old index
                    slider.working = false; // is not in motion
                    return;
                }

                if (direction === 'next') {
                    // Prevent canceling in future functions or lack there-of from negating previous commands to cancel
                    if (!slider.settings.onSlideNext.call(el, slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index)) {
                        performTransition = false;
                    }
                } else if (direction === 'prev') {
                    // Prevent canceling in future functions or lack there-of from negating previous commands to cancel
                    if (!slider.settings.onSlidePrev.call(el, slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index)) {
                        performTransition = false;
                    }
                }

                // check if last slide
                slider.active.last = slider.active.index >= getPagerQty() - 1;
                // update the pager with active class
                if (slider.settings.pager || slider.settings.pagerCustom) { updatePagerActive(slider.active.index); }
                // // check for direction control update
                if (slider.settings.controls) { updateDirectionControls(); }
                // if slider is set to mode: "fade"
                if (slider.settings.mode === 'fade') {
                    // if adaptiveHeight is true and next height is different from current height, animate to the new height
                    if (slider.settings.adaptiveHeight && slider.viewport.height() !== getViewportHeight()) {
                        slider.viewport.animate({height: getViewportHeight()}, slider.settings.adaptiveHeightSpeed);
                    }
                    // fade out the visible child and reset its z-index value
                    slider.children.filter(':visible').fadeOut(slider.settings.speed).css({zIndex: 0});
                    // fade in the newly requested slide
                    slider.children.eq(slider.active.index).css('zIndex', slider.settings.slideZIndex + 1).fadeIn(slider.settings.speed, function() {
                        $(this).css('zIndex', slider.settings.slideZIndex);
                        updateAfterSlideTransition();
                    });
                    // slider mode is not "fade"
                } else {
                    // if adaptiveHeight is true and next height is different from current height, animate to the new height
                    if (slider.settings.adaptiveHeight && slider.viewport.height() !== getViewportHeight()) {
                        slider.viewport.animate({height: getViewportHeight()}, slider.settings.adaptiveHeightSpeed);
                    }
                    // if carousel and not infinite loop
                    if (!slider.settings.infiniteLoop && slider.carousel && slider.active.last) {
                        if (slider.settings.mode === 'horizontal') {
                            // get the last child position
                            lastChild = slider.children.eq(slider.children.length - 1);
                            position = lastChild.position();
                            // calculate the position of the last slide
                            moveBy = slider.viewport.width() - lastChild.outerWidth();
                        } else {
                            // get last showing index position
                            lastShowingIndex = slider.children.length - slider.settings.minSlides;
                            position = slider.children.eq(lastShowingIndex).position();
                        }
                        // horizontal carousel, going previous while on first slide (infiniteLoop mode)
                    } else if (slider.carousel && slider.active.last && direction === 'prev') {
                        // get the last child position
                        eq = slider.settings.moveSlides === 1 ? slider.settings.maxSlides - getMoveBy() : ((getPagerQty() - 1) * getMoveBy()) - (slider.children.length - slider.settings.maxSlides);
                        lastChild = el.children('.bx-clone').eq(eq);
                        position = lastChild.position();
                        // if infinite loop and "Next" is clicked on the last slide
                    } else if (direction === 'next' && slider.active.index === 0) {
                        // get the last clone position
                        position = el.find('> .bx-clone').eq(slider.settings.maxSlides).position();
                        slider.active.last = false;
                        // normal non-zero requests
                    } else if (slideIndex >= 0) {
                        //parseInt is applied to allow floats for slides/page
                        requestEl = slideIndex * parseInt(getMoveBy());
                        position = slider.children.eq(requestEl).position();
                    }

                    /* If the position doesn't exist
                     * (e.g. if you destroy the slider on a next click),
                     * it doesn't throw an error.
                     */
                    if (typeof (position) !== 'undefined') {
                        value = slider.settings.mode === 'horizontal' ? -(position.left - moveBy) : -position.top;
                        // plugin values to be animated
                        setPositionProperty(value, 'slide', slider.settings.speed);
                    }
                    slider.working = false;
                }
                if (slider.settings.ariaHidden) { applyAriaHiddenAttributes(slider.active.index * getMoveBy()); }
            };

            /**
             * Transitions to the next slide in the show
             */
            el.goToNextSlide = function() {
                // if infiniteLoop is false and last page is showing, disregard call
                if (!slider.settings.infiniteLoop && slider.active.last) { return; }
                if (slider.working === true){ return ;}
                var pagerIndex = parseInt(slider.active.index) + 1;
                el.goToSlide(pagerIndex, 'next');
            };

            /**
             * Transitions to the prev slide in the show
             */
            el.goToPrevSlide = function() {
                // if infiniteLoop is false and last page is showing, disregard call
                if (!slider.settings.infiniteLoop && slider.active.index === 0) { return; }
                if (slider.working === true){ return ;}
                var pagerIndex = parseInt(slider.active.index) - 1;
                el.goToSlide(pagerIndex, 'prev');
            };

            /**
             * Starts the auto show
             *
             * @param preventControlUpdate (boolean)
             *  - if true, auto controls state will not be updated
             */
            el.startAuto = function(preventControlUpdate) {
                // if an interval already exists, disregard call
                if (slider.interval) { return; }
                // create an interval
                slider.interval = setInterval(function() {
                    if (slider.settings.autoDirection === 'next') {
                        el.goToNextSlide();
                    } else {
                        el.goToPrevSlide();
                    }
                }, slider.settings.pause);
                //allback for when the auto rotate status changes
                slider.settings.onAutoChange.call(el, true);
                // if auto controls are displayed and preventControlUpdate is not true
                if (slider.settings.autoControls && preventControlUpdate !== true) { updateAutoControls('stop'); }
            };

            /**
             * Stops the auto show
             *
             * @param preventControlUpdate (boolean)
             *  - if true, auto controls state will not be updated
             */
            el.stopAuto = function(preventControlUpdate) {
                // if slider is auto paused, just clear that state
                if (slider.autoPaused) slider.autoPaused = false;
                // if no interval exists, disregard call
                if (!slider.interval) { return; }
                // clear the interval
                clearInterval(slider.interval);
                slider.interval = null;
                //allback for when the auto rotate status changes
                slider.settings.onAutoChange.call(el, false);
                // if auto controls are displayed and preventControlUpdate is not true
                if (slider.settings.autoControls && preventControlUpdate !== true) { updateAutoControls('start'); }
            };

            /**
             * Returns current slide index (zero-based)
             */
            el.getCurrentSlide = function() {
                return slider.active.index;
            };

            /**
             * Returns current slide element
             */
            el.getCurrentSlideElement = function() {
                return slider.children.eq(slider.active.index);
            };

            /**
             * Returns a slide element
             * @param index (int)
             *  - The index (zero-based) of the element you want returned.
             */
            el.getSlideElement = function(index) {
                return slider.children.eq(index);
            };

            /**
             * Returns number of slides in show
             */
            el.getSlideCount = function() {
                return slider.children.length;
            };

            /**
             * Return slider.working variable
             */
            el.isWorking = function() {
                return slider.working;
            };

            /**
             * Update all dynamic slider elements
             */
            el.redrawSlider = function() {
                // resize all children in ratio to new screen size
                slider.children.add(el.find('.bx-clone')).outerWidth(getSlideWidth());
                // adjust the height
                slider.viewport.css('height', getViewportHeight());
                // update the slide position
                if (!slider.settings.ticker) { setSlidePosition(); }
                // if active.last was true before the screen resize, we want
                // to keep it last no matter what screen size we end on
                if (slider.active.last) { slider.active.index = getPagerQty() - 1; }
                // if the active index (page) no longer exists due to the resize, simply set the index as last
                if (slider.active.index >= getPagerQty()) { slider.active.last = true; }
                // if a pager is being displayed and a custom pager is not being used, update it
                if (slider.settings.pager && !slider.settings.pagerCustom) {
                    populatePager();
                    updatePagerActive(slider.active.index);
                }
                if (slider.settings.ariaHidden) { applyAriaHiddenAttributes(slider.active.index * getMoveBy()); }
            };

            /**
             * Destroy the current instance of the slider (revert everything back to original state)
             */
            el.destroySlider = function() {
                // don't do anything if slider has already been destroyed
                if (!slider.initialized) { return; }
                slider.initialized = false;
                $('.bx-clone', this).remove();
                slider.children.each(function() {
                    if ($(this).data('origStyle') !== undefined) {
                        $(this).attr('style', $(this).data('origStyle'));
                    } else {
                        $(this).removeAttr('style');
                    }
                });
                if ($(this).data('origStyle') !== undefined) {
                    this.attr('style', $(this).data('origStyle'));
                } else {
                    $(this).removeAttr('style');
                }
                $(this).unwrap().unwrap();
                if (slider.controls.el) { slider.controls.el.remove(); }
                if (slider.controls.next) { slider.controls.next.remove(); }
                if (slider.controls.prev) { slider.controls.prev.remove(); }
                if (slider.pagerEl && slider.settings.controls && !slider.settings.pagerCustom) { slider.pagerEl.remove(); }
                $('.bx-caption', this).remove();
                if (slider.controls.autoEl) { slider.controls.autoEl.remove(); }
                clearInterval(slider.interval);
                if (slider.settings.responsive) { $(window).off('resize', resizeWindow); }
                if (slider.settings.keyboardEnabled) { $(document).off('keydown', keyPress); }
                //remove self reference in data
                $(this).removeData('bxSlider');
                // remove global window handlers
                $(window).off('blur', windowBlurHandler).off('focus', windowFocusHandler);
            };

            /**
             * Reload the slider (revert all DOM changes, and re-initialize)
             */
            el.reloadSlider = function(settings) {
                if (settings !== undefined) { options = settings; }
                el.destroySlider();
                init();
                //store reference to self in order to access public functions later
                $(el).data('bxSlider', this);
            };

            init();

            $(el).data('bxSlider', this);

            // returns the current jQuery object
            return this;
        };

    })(jQuery);

    return;
});

define('SuiteCommerce.Slideshow.Common.Utils',
    [
        'jQuery'
    ],
    function (jQuery) {
        return {
            trim: function trim(str) {
                return jQuery.trim(str);
            },

            isPhoneDevice: function isPhoneDevice() {
                return this.getDeviceType() === 'phone';
            },

            getDeviceType: function getDeviceType(widthToCheck) {
                const width = widthToCheck || this.getViewportWidth();

                if (width !== undefined && width < 768) {
                    return 'phone';
                }
                if (width !== undefined && width < 992) {
                    return 'tablet';
                }
                return 'desktop';
            },

            getViewportWidth: function getViewportWidth() {
                var viewportWidth = 0;
                if (jQuery(window).width() !== undefined) {
                    viewportWidth = jQuery(window).width();
                }
                return viewportWidth;
            }

        }
    });

define(    'NetSuite.Slideshow.SlideshowCCT',    [        'NetSuite.Slideshow.SlideshowCCT.View'    ],    function (        SlideshowCCTView    ) {        'use strict';        return {            mountToApp: function mountToApp(container) {                container.getComponent('CMS').registerCustomContentType({                    id: 'cct_netsuite_slideshowcct',                    view: SlideshowCCTView,                    options: {                        container: container                    }                });            }        };    });

define('NetSuite.Slideshow.SlideshowCCT.Collection',    [        'NetSuite.Slideshow.SlideshowCCT.Model',        'Backbone'    ],    function (SlideshowCCTModel, Backbone) {        'use strict';        return Backbone.Collection.extend({            model: SlideshowCCTModel        });    });

define('NetSuite.Slideshow.SlideshowCCT.Model',    ['Backbone'],    function (Backbone) {        'use strict';        return Backbone.Model.extend({            isEmpty: function () {                return !this.get('imageURL');            }        });    });

define('NetSuite.Slideshow.SlideshowCCT.View',    [        'CustomContentType.Base.View',        'NetSuite.Slideshow.SlideshowCCT.Collection',        'NetSuite.Slideshow.SlideshowCCT.Model',        'netsuite_slideshow_slideshowcct.tpl',        'jQuery',        'SuiteCommerce.Slideshow.Common.Utils',        'underscore',        'jQuery.bxSlider@4.2.14'    ],    function (        CustomContentTypeBaseView,        SlideshowCCTCollection,        SlideshowCCTModel,        netsuite_slideshow_slideshowcct_tpl,        jQuery,        Utils,        _    ) {        'use strict';        return CustomContentTypeBaseView.extend({            template: netsuite_slideshow_slideshowcct_tpl,            IMG_ALIGN_MAP: {                1: 'bg-center-top',                2: 'bg-center-center',                3: 'bg-center-bottom'            },            IMG_OVERLAY_MAP: {                1: '',                2: 'content-dark',                3: 'content-light'            },            TEXT_ALIGN_MAP: {                1: 'content-box-left',                2: 'content-box-right',                3: 'content-box-center'            },            TEXT_COLOR_MAP: {                1: 'content-color-text-dark',                2: 'content-color-text-light'            },            BTN_STYLE_MAP: {                1: 'button-style-one',                2: 'button-style-two'            },            SPEED_MAP: {                1: '3000',                2: '4000',                3: '5000',                4: '6000',                5: '7000',                6: '8000'            },            SECTION_HEIGHT_MAP: {                1: 'section-small',                2: 'section-medium',                3: 'section-large'            },            HTML_TAGS_REGEX: /<[^>]+>/ig,            initialize: function initialize(options) {                if (options) {                    this.container = options.container;                }                this._initialize();                var self = this;                this.on('afterViewRender', function () {                    self.$('img').on('load', function () {                        var hasMoreThanOneSlider = (self.$('.slideshow-slider').children().length > 1);                        if (hasMoreThanOneSlider) {                            var speed = self.SPEED_MAP[Utils.trim(self.settings.custrecord_cct_ns_ss_transition_speed)];                            var auto = Utils.trim(self.settings.custrecord_cct_ns_ss_auto) === 'T';                            if (!self.$('.bx-wrapper').length) {                                self.sliderContainer = self.$('.slideshow-slider').bxSliderNew({                                    nextText: (Utils.isPhoneDevice() ? '' : '<a class="slideshow-next-icon"></a>'),                                    prevText: (Utils.isPhoneDevice() ? '' : '<a class="slideshow-prev-icon"></a>'),                                    touchEnabled: true,                                    auto: auto,                                    pager: true,                                    pause: speed                                });                            } else {                                if (self.sliderContainer) {                                    self.sliderContainer.redrawSlider();                                }                            }                        }                    });                });            },            install: function (settings, context_data) {                this._install(settings, context_data);                var promise = jQuery.Deferred();                return promise.resolve();            },            contextDataRequest: ['item'],            validateContextDataRequest: function validateContextDataRequest() {                return true;            },            getContext: function getContext() {                return {                    sectionHeight: Utils.isPhoneDevice() ? this.SECTION_HEIGHT_MAP[1] : this.SECTION_HEIGHT_MAP[this.settings.custrecord_cct_ns_ss_section_height],                    slideshowList: this.createSlideshowCollection().toJSON()                }            },            createSlideshowCollection: function () {                var slideshowCCTCollection = new SlideshowCCTCollection();                var slideshowNumbers = ['1', '2', '3', '4', '5', '6', '7', '8'];                for (var i = 0; i < slideshowNumbers.length; i++) {                    var slideshow = this.createSlideshow(slideshowNumbers[i]);                    if (!slideshow.isEmpty()) {                        slideshowCCTCollection.add(slideshow);                    }                }                return slideshowCCTCollection;            },            createSlideshow: function (itemNumber) {                return new SlideshowCCTModel({                    id: itemNumber,                    text: this.settings['custrecord_cct_ns_ss_text' + itemNumber],                    hasText: Utils.trim(this.settings['custrecord_cct_ns_ss_text' + itemNumber]).replace(this.HTML_TAGS_REGEX, '') !== '',                    imageURL: Utils.trim(this.settings['custrecord_cct_ns_ss_img' + itemNumber + '_url']),                    altText: Utils.trim(this.settings['custrecord_cct_ns_ss_alternative_text' + itemNumber]),                    imgAlignClass: this.IMG_ALIGN_MAP[this.settings['custrecord_cct_ns_ss_img_alignment' + itemNumber]],                    imgOverlayClass: this.IMG_OVERLAY_MAP[this.settings['custrecord_cct_ns_ss_img_overlay' + itemNumber]],                    opacityClass: !!this.IMG_OVERLAY_MAP[this.settings['custrecord_cct_ns_ss_img_overlay' + itemNumber]] ? 'image-opacity' : '',                    textAlignClass: this.TEXT_ALIGN_MAP[this.settings['custrecord_cct_ns_ss_text_alignment' + itemNumber]],                    textColorClass: this.TEXT_COLOR_MAP[this.settings['custrecord_cct_ns_ss_text_color' + itemNumber]],                    btnStyleClass: this.BTN_STYLE_MAP[this.settings['custrecord_cct_ns_ss_btn_style' + itemNumber]],                    btnText: Utils.trim(this.settings['custrecord_cct_ns_ss_btn_text' + itemNumber]),                    hasBtnText: !!Utils.trim(this.settings['custrecord_cct_ns_ss_btn_text' + itemNumber]),                    btnLink: Utils.trim(this.settings['custrecord_cct_ns_ss_btn_link' + itemNumber]),                    target: Utils.trim(this.settings['custrecord_cct_ns_ss_new_window' + itemNumber]) === 'T' ? '_blank' : '_self'                });            }        });    });

define(
    'NetSuite.Slideshow.SlideshowModule',
    [
        'NetSuite.Slideshow.SlideshowCCT'
    ],
    function (SlideshowCCT) {
        'use strict';
        return {
            mountToApp: function mountToApp(container) {
                SlideshowCCT.mountToApp(container);
            }
        };
    });

};

extensions['Tavano.Klaviyo.3.0.6'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/Tavano/Klaviyo/3.0.6/' + asset;
};


define('Tavano.Klaviyo.Cart.Sync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

    var isCartUpdateInProgress = false;

	var KlaviyoCartSync = {

		getParentImages : function(parentImages){

			var finalImagesProcessed = [];

			for (var prop in parentImages) {
				if (Object.prototype.hasOwnProperty.call(parentImages, prop)) {
					

					// Level 2

					for (var propLevel2 in parentImages[prop]) {
						if (Object.prototype.hasOwnProperty.call(parentImages[prop], propLevel2)) {
							
							if (propLevel2 == "url"){
								finalImagesProcessed.push(parentImages[prop][propLevel2])
								
							}else{


								// Level 3

								for (var propLevel3 in parentImages[prop][propLevel2]) {
								if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2], propLevel3)) {
									
									if (propLevel3 == "url"){

										finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3])
										
										}else{

											// Level 4

											for (var propLevel4 in parentImages[prop][propLevel2][propLevel3]) {
											if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2][propLevel3], propLevel4)) {
												
												if (propLevel4 == "url"){

													finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3][propLevel4])
													
													}else{
														// Add more levels nestede here

													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}


			return finalImagesProcessed;



		},

		addCustomFields : function(line,parentItem,environment_component,klaviyoObject,isMatrixChild){

			
			try{
				var customFields = environment_component.getConfig("tavanoKlaviyo").columns.customFields || [];
				

				_.each(customFields,function(customField){
					
					if (isMatrixChild && customField.nsidparent && customField.nsidparent != ""){
	
						klaviyoObject[customField.klaviyokey] = parentItem[customField.nsidparent]
	
					}else{

						if (customField && customField.nsid == "displayname"){
							klaviyoObject[customField.klaviyokey] = line.item.displayname
						}else{
							klaviyoObject[customField.klaviyokey] = line.item.extras[customField.nsid]
						}
						
					}
					
				})
			}catch(e){
				console.log("Impossible to add custom fields");
				console.log(JSON.stringify(e))
			}
        },


        sendAddLineEvent:  function(cart,environment_component){

			var self = this;



			setTimeout(function(){
				
				isCartUpdateInProgress = false
			 }, 3000);

			 
			 if (!isCartUpdateInProgress){
				isCartUpdateInProgress = true;

				cart.getLines().then(function(lines) {


					var klaviyoObject = {};


					var session = environment_component.getSession()

					// ---------------------------
					// SiteID and Domain
					// ---------------------------
					var siteId = environment_component.getConfig("siteSettings.siteid");
					var domain = location.protocol + "//" + location.host;
					
					klaviyoObject["site_id"] = siteId;
					klaviyoObject["domain"] = domain;
                
					// ---------------------------
					// Currency
					// ---------------------------
					var currency_code = session.currency.code;
					var currency_name = session.currency.currencyname
					var currency_symbol = session.currency.symbol
					

					klaviyoObject["currency_code"] = currency_code;
					klaviyoObject["currency_name"] = currency_name;
					klaviyoObject["currency_symbol"] = currency_symbol;
					
					// ---------------------------
					// Language
					// ---------------------------
					var language_name = session.language.name;
					klaviyoObject["language_name"] = language_name;

					

					var Items = [];
				
					_.each(lines,function(line,lineIndex){

						var dataLine = {
							"ProductID" : line.item.internalid,
							"SKU": line.item.extras.keyMapping_sku,
							"ProductName": line.item.extras.displayname || line.item.extras.storedisplayname || line.item.extras.storedisplayname2,
							"Quantity":line.quantity,
							"ItemPrice":line.rate,
							"RowTotal":line.amount,
							"ProductURL":klaviyoObject["domain"] + line.item.extras.keyMapping_url,
							"ImageURL":line.item.extras.keyMapping_images.length > 0 ?line.item.extras.keyMapping_images[0].url:"",
						}
						
						
						var matrixParent = line.item.extras.matrix_parent;

						self.addCustomFields(line,matrixParent,environment_component,dataLine,matrixParent)
						Items.push(dataLine)


						// Handle Images
						
						if (matrixParent){

							var allImages = self.getParentImages(matrixParent.itemimages_detail);

							var matrixOptionValues = [];
							_.each(line.options,function(option){
								if (option && option.isMatrixDimension && option.value)
									matrixOptionValues.push(option.value.label)
							})

							
							
							var mainImage
							// Now we only have to pick the Image from the entire list of images
							for (var i=0 ; i< allImages.length; i++){
								var allCheck = true;
								for (var j = 0; j < matrixOptionValues.length; j++){
									if (allImages[i] && allImages[i].toLowerCase().indexOf(matrixOptionValues[j].toLowerCase())!= -1){
										
										
									}else{
										allCheck = false;
									}
								}

								if (allCheck){
									mainImage = allImages[i]
								}


							}
							
		
							if (mainImage){
								Items[lineIndex]["ImageURL"] = mainImage
							}else{
								// If we didn't found the image, we assign the first that we can
								if (allImages && allImages.length > 0)
									Items[lineIndex]["ImageURL"] = allImages[0];
		
							}
						}

						// End Handle Images

					})
	
					

					var ItemNames = _.map(Items,function(item){
						return item["ProductName"]
					})
	
					
					// Add new Line row
					// Not necessary
					// if (lines && lines.length > 0){
					// 	klaviyoObject["AddedItemProductName"] = lines[0].item.extras.keyMapping_name;
					// 	klaviyoObject["AddedItemProductID"] = lines[0].item.itemid;
					// 	klaviyoObject["AddedItemSKU"] = lines[0].item.extras.keyMapping_sku;
					// 	klaviyoObject["AddedItemImageURL"] = lines[0].item.extras.keyMapping_images.length > 0 ?lines[0].item.extras.keyMapping_images[0].url:"";
					// 	klaviyoObject["AddedItemURL"] = lines[0].item.extras.keyMapping_url;
					// 	klaviyoObject["AddedItemPrice"] = lines[0].rate;
					// 	klaviyoObject["AddedItemQuantity"] = lines[0].quantity;
					// }
	
					klaviyoObject["ItemNames"] = ItemNames;
					klaviyoObject["Items"] = Items;
	
	
					cart.getSummary().then(function(summary) {
	
						
	
						klaviyoObject["$value"] = summary.subtotal;
	
	
	
						var addedToCartEventData = {
							'event':'klaviyoAddedToCart',
							'klaviyo_data': klaviyoObject
						};
						window["dataLayer"].push(addedToCartEventData);
	
					});

				});



			 }
			 
			 
		},

        sendUpdateLineEvent:  function(cart,environment_component){

			var self = this;
		

			setTimeout(function(){
				
				isCartUpdateInProgress = false
			 }, 3000);


			 
			 if (!isCartUpdateInProgress){
				isCartUpdateInProgress = true;

				cart.getLines().then(function(lines) {

					var klaviyoObject = {};

					var session = environment_component.getSession()

					// SiteID and Domain
					// ---------------------------
					var siteId = environment_component.getConfig("siteSettings.siteid");
					var domain = location.protocol + "//" + location.host;
					
					klaviyoObject["site_id"] = siteId;
					klaviyoObject["domain"] = domain;
                
					// ---------------------------
					// Currency
					// ---------------------------
					var currency_code = session.currency.code;
					var currency_name = session.currency.currencyname
					var currency_symbol = session.currency.symbol
					

					klaviyoObject["currency_code"] = currency_code;
					klaviyoObject["currency_name"] = currency_name;
					klaviyoObject["currency_symbol"] = currency_symbol;
					
					// ---------------------------
					// Language
					// ---------------------------
					var language_name = session.language.name;
					klaviyoObject["language_name"] = language_name;



					var Items = [];

					
					
					_.each(lines,function(line,lineIndex){

						var dataLine = {
							"ProductID" : line.item.internalid,
							"SKU": line.item.extras.keyMapping_sku,
							"ProductName": line.item.extras.displayname || line.item.extras.storedisplayname || line.item.extras.storedisplayname2,
							"Quantity":line.quantity,
							"ItemPrice":line.rate,
							"RowTotal":line.amount,
							"ProductURL":klaviyoObject["domain"] + line.item.extras.keyMapping_url,
							"ImageURL":line.item.extras.keyMapping_images.length > 0 ?line.item.extras.keyMapping_images[0].url:"",
						}
						
						var matrixParent = line.item.extras.matrix_parent;


						self.addCustomFields(line,matrixParent,environment_component,dataLine,matrixParent)
						Items.push(dataLine);


						// Handle Images
						
						if (matrixParent){

							var allImages = self.getParentImages(matrixParent.itemimages_detail)

							var matrixOptionValues = [];
							_.each(line.options,function(option){
								if (option && option.isMatrixDimension && option.value)
									matrixOptionValues.push(option.value.label)
							})

							
							
							var mainImage
							// Now we only have to pick the Image from the entire list of images
							for (var i=0 ; i< allImages.length; i++){
								var allCheck = true;
								for (var j = 0; j < matrixOptionValues.length; j++){
									if (allImages[i] && allImages[i].toLowerCase().indexOf(matrixOptionValues[j].toLowerCase())!= -1){
										
										
									}else{
										allCheck = false;
									}
								}

								if (allCheck){
									mainImage = allImages[i]
								}


							}
							
		
							if (mainImage){
								Items[lineIndex]["ImageURL"] = mainImage
							}else{
								// If we didn't found the image, we assign the first that we can
								if (allImages && allImages.length > 0)
									Items[lineIndex]["ImageURL"] = allImages[0];
		
							}
						}

						// End Handle Images

					})
				
					var ItemNames = _.map(Items,function(item){
						return item["ProductName"]
					})
	
					klaviyoObject["ItemNames"] = ItemNames;
					klaviyoObject["Items"] = Items;



					
					
	
	
					cart.getSummary().then(function(summary) {
	
						klaviyoObject["$value"] = summary.subtotal;
	

						var addedToCartEventData = {
							'event':'klaviyoAddedToCart',
							'klaviyo_data': klaviyoObject
						};
						window["dataLayer"].push(addedToCartEventData);
	
					});

				});



			 }
			 
			 
		},



    }

	return KlaviyoCartSync;
});



define('Tavano.Klaviyo.Checkout.Sync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoCheckoutSync = {




		getParentImages : function(parentImages){

			var finalImagesProcessed = [];

			for (var prop in parentImages) {
				if (Object.prototype.hasOwnProperty.call(parentImages, prop)) {
					

					// Level 2

					for (var propLevel2 in parentImages[prop]) {
						if (Object.prototype.hasOwnProperty.call(parentImages[prop], propLevel2)) {
							
							if (propLevel2 == "url"){
								finalImagesProcessed.push(parentImages[prop][propLevel2])
								
							}else{


								// Level 3

								for (var propLevel3 in parentImages[prop][propLevel2]) {
								if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2], propLevel3)) {
									
									if (propLevel3 == "url"){

										finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3])
										
										}else{

											// Level 4

											for (var propLevel4 in parentImages[prop][propLevel2][propLevel3]) {
											if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2][propLevel3], propLevel4)) {
												
												if (propLevel4 == "url"){

													finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3][propLevel4])
													
													}else{
														// Add more levels nestede here

													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}


			return finalImagesProcessed;



		},
        
        sendCheckoutInfo: function(cart,environment_component){

			var self = this;

			var session = environment_component.getSession()
			

			var klaviyoObject = {};
			
			// ---------------------------
			// Currency
			// ---------------------------
			var currency_code = session.currency.code;
			var currency_name = session.currency.currencyname
			var currency_symbol = session.currency.symbol
			

			klaviyoObject["currency_code"] = currency_code;
			klaviyoObject["currency_name"] = currency_name;
			klaviyoObject["currency_symbol"] = currency_symbol;


			// ---------------------------
			// SiteID and Domain
			// ---------------------------
			var siteId = environment_component.getConfig("siteSettings.siteid");
			var domain = location.protocol + "//" + location.host;
			
			klaviyoObject["site_id"] = siteId;
			klaviyoObject["domain"] = domain;
			
			// ---------------------------
			// Language
			// ---------------------------
			var language_name = session.language.name;

			klaviyoObject["language_name"] = language_name;

			cart.getSummary().then(function(summary) {

				klaviyoObject["$event_id"] = Date.now().toString();
				klaviyoObject["$value"] = summary.total;
				klaviyoObject["items_subtotal"] = summary.subtotal;
				klaviyoObject["$CheckoutURL"] = location.href;
				
			});

			

			cart.getLines().then(function(lines) {


				var Items = [];
				
				_.each(lines,function(line,lineIndex){

					Items.push({
						"ProductID" : line.item.itemid,
						"SKU": line.item.extras.keyMapping_sku,
						"ProductName": line.item.itemid,
						"Quantity":line.quantity,
						"ItemPrice":line.rate,
						"RowTotal":line.amount,
						"ProductURL":klaviyoObject["domain"] + line.item.extras.keyMapping_url,
						"ImageURL":line.item.extras.keyMapping_images.length > 0 ?line.item.extras.keyMapping_images[0].url:"",
					})


					// Handle Images

					var matrixParent = line.item.extras.matrix_parent;
					
					if (matrixParent){

						// In this case the all images are related to the child
						// var allImages = _.map(line.item.extras.keyMapping_images,function(image){
						// 	return image.url
						// })
						

						var allImages = self.getParentImages(matrixParent.itemimages_detail)

						var matrixOptionValues = [];
						_.each(line.options,function(option){
							if (option && option.isMatrixDimension && option.value)
								matrixOptionValues.push(option.value.label)
						})

						
						
						var mainImage
						// Now we only have to pick the Image from the entire list of images
						for (var i=0 ; i< allImages.length; i++){
							var allCheck = true;
							for (var j = 0; j < matrixOptionValues.length; j++){
								if (allImages[i] && allImages[i].toLowerCase().indexOf(matrixOptionValues[j].toLowerCase())!= -1){
									
									
								}else{
									allCheck = false;
								}
							}

							if (allCheck){
								mainImage = allImages[i]
							}


						}
						
	
						if (mainImage){
							Items[lineIndex]["ImageURL"] = mainImage
						}else{
							// If we didn't found the image, we assign the first that we can
							if (allImages && allImages.length > 0)
								Items[lineIndex]["ImageURL"] = allImages[0];
	
						}
					}

					// End Handle Images

				})

				var ItemNames = _.map(lines,function(line){
					return line.item.itemid
				})

				klaviyoObject["ItemNames"] = ItemNames;
				klaviyoObject["Items"] = Items;

				var eventData = {
					'event':'klaviyoStartedCheckout',
					'klaviyo_data': klaviyoObject
				};


				
				!window.checkoutStarted && window["dataLayer"].push(eventData);
				window.checkoutStarted = true;
				


			});

        }
       
    }

	return TavanoKlaviyoCheckoutSync;
});



define('Tavano.Klaviyo.LoaderSync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoLoaderSync = {
        
        addLoader : function(){
            
            
            var loadScriptEventData = {
                'event':'klaviyoLoadScript',
                'klaviyo_data': {}
            };
            !window.loaderCompleted && window["dataLayer"].push(loadScriptEventData);
            window.loaderCompleted = true;

            Backbone.trigger("KlaviyoLoaderCompleted")
            
        }
    }

	return TavanoKlaviyoLoaderSync;
});



define('Tavano.Klaviyo.Order.Sync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoOrderSync = {
        
        sendOrderDetailsInfo : function(cart,userprofilecomponent){

            self.cart = cart;

            if (cart){

                cart.on("beforeSubmit",function(data){

                    // Pre-save the following information
                    // Shipping Address
                    // Billing Address
                    // Customer Information

                    userprofilecomponent.getUserProfile().then(function(profile) {
                        
                        var profile = {
                            "$email": profile.email,
                            "$first_name": profile.firstname,
                            "$last_name": profile.lastname,
                            "$phone_number": profile.phoneinfo ? profile.phoneinfo.phone : "",
                            "$address1": profile.addresses.length > 0 ? profile.addresses[0].addr1 : "",
                            "$address2": profile.addresses.length > 0 ? profile.addresses[0].addr2 : "",
                            "$city": profile.addresses.length > 0 ? profile.addresses[0].city : "",
                            "$zip": profile.addresses.length > 0 ? profile.addresses[0].zip : "",
                            "$region":profile.addresses.length > 0 ? profile.addresses[0].state : "",
                            "$country": profile.addresses.length > 0 ? profile.addresses[0].country : "",
                        }

                        sessionStorage.setItem('customer_properties', JSON.stringify(profile));    
                        
                    });


                    self.cart.getShipAddress().then(function(shippingAddress) {
                        sessionStorage.setItem('shippingAddress', JSON.stringify(shippingAddress));    
                    })

                    self.cart.getBillAddress().then(function(billingAddress) {
                        sessionStorage.setItem('billingAddress', JSON.stringify(billingAddress));    
                    })



                    cart.getLines().then(function(lines) {

                        

                        var Items = _.map(lines,function(line){
                            return {
                                "ProductID" : line.item.itemid,
                                "SKU": line.item.extras.keyMapping_sku,
                                "ProductName": line.item.extras.keyMapping_name,
                                "Quantity":line.quantity,
                                "ItemPrice":line.rate,
                                "RowTotal":line.amount,
                                "ProductURL":line.item.extras.keyMapping_url,
                                "ImageURL":line.item.extras.keyMapping_images.length > 0 ?line.item.extras.keyMapping_images[0].url:"",
                            }
                        })
        
                        var ItemNames = _.map(lines,function(line){
                            return line.item.extras.keyMapping_name
                        })

                        sessionStorage.setItem('ItemNames', JSON.stringify(ItemNames));    

                        sessionStorage.setItem('Items', JSON.stringify(Items));    



                        
                    })

                })
    
                cart.on("afterSubmit",function(data){

                    
                    
                    var klaviyoObject = {};


                    klaviyoObject["$value"] = data.confirmation.summary.total;
                    klaviyoObject["OrderId"] = data.confirmation.tranid;

                    if (data.promocodes && data.promocodes.length > 0){

                        klaviyoObject["DiscountCode"] = "";
                        klaviyoObject["DiscountValue"] = data.confirmation.summary.extras.discounttotal_formatted;
                    }

                    
        
                    // Adding Shipping and Billing Addresses

                    var billingAddress = JSON.parse(sessionStorage.getItem('billingAddress'));
                    var shippingAddress = JSON.parse(sessionStorage.getItem('shippingAddress'));
                    var customer_properties = JSON.parse(sessionStorage.getItem('customer_properties'));
                    var Items = JSON.parse(sessionStorage.getItem('Items'));
                    var ItemNames = JSON.parse(sessionStorage.getItem('ItemNames'));


                    klaviyoObject["ItemNames"] = ItemNames;
                    klaviyoObject["Items"] = Items;
                    

                    klaviyoObject["BillingAddress"] = {

                        "FirstName": billingAddress.fullname,
                        "LastName": billingAddress.fullname,
                        "Company": billingAddress.company,
                        "Address1": billingAddress.addr1,
                        "Address2": billingAddress.addr2,
                        "City": billingAddress.city,
                        "Region": billingAddress.state,
                        "RegionCode":billingAddress.state,
                        "Country": billingAddress.country,
                        "CountryCode": billingAddress.country,
                        "Zip": billingAddress.zip,
                        "Phone": billingAddress.phone,
                    };

                    klaviyoObject["ShippingAddress"] = {
                        
                        "FirstName": shippingAddress.fullname,
                        "LastName": shippingAddress.fullname,
                        "Company": shippingAddress.company,
                        "Address1": shippingAddress.addr1,
                        "Address2": shippingAddress.addr2,
                        "City": shippingAddress.city,
                        "Region": shippingAddress.state,
                        "RegionCode":shippingAddress.state,
                        "Country": shippingAddress.country,
                        "CountryCode": shippingAddress.country,
                        "Zip": shippingAddress.zip,
                        "Phone": shippingAddress.phone,
                    };



                    // Not necessary
                    // klaviyoObject["customer_properties"] = customer_properties;

                    var addedToCartEventData = {
                        'event':'klaviyoPlacedOrder',
                        'klaviyo_data': klaviyoObject
                    };
                    // window["dataLayer"].push(addedToCartEventData);


                })

            }
        }
    }

	return TavanoKlaviyoOrderSync;
});



define('Tavano.Klaviyo.ProductView.Sync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoProductViewSync = {


        addPossiblePriceLevels: function(line,session,klaviyoObject){

            for (var i=1; i < 50; i++ ){

                var priceLevel = line.item["pricelevel" + i];
                var priceLevelFormatted = line.item["pricelevel" + i + "_formatted"];

                if (priceLevel && priceLevelFormatted){
                    klaviyoObject["pricelevel" + i] = priceLevel;
                    klaviyoObject["pricelevel" + i + "_formatted"] = priceLevelFormatted;

                    // Adding the price level assigned to the customer in a new variable
                    // if ( i.toString() == session.priceLevel ){
                    //     klaviyoObject["PriceForCustomer"] = priceLevel;
                    //     klaviyoObject["PriceForCustomer_formatted"] = priceLevelFormatted;
                    // }
                }
                
            }
        },


        addCustomFields : function(itemToSend,parentItem,environment_component,klaviyoObject,isMatrixChild){
            
            var customFields = environment_component.getConfig("tavanoKlaviyo").columns.customFields || [];

            _.each(customFields,function(customField){
                if (isMatrixChild && customField.nsidparent && customField.nsidparent != ""){

                    klaviyoObject[customField.klaviyokey] = parentItem[customField.nsidparent]

                }else{
                    klaviyoObject[customField.klaviyokey] = itemToSend[customField.nsid]
                }
                
            })

        },
        
        sendProductDetailsInfo : function(pdp,environment_component,klaviyoObject){
            
            var line = pdp.getItemInfo();

            if (!line)
                return
            var isMatrixItem = pdp.getAllMatrixChilds().length > 0;
            var isSelectionComplete = pdp.getSelectedMatrixChilds().length == 1;

            
            
            if (line){

                var categories ;
                var allImages = [];
                var itemToSend = line.item;
                var parentItem = line.item;
                var multiImageOptionValues = [];

                if (line.item.commercecategory && line.item.commercecategory.categories && line.item.commercecategory.categories.length > 0){
                    categories = _.map(line.item.commercecategory.categories,function(category){
                        return category.name
                    })
                }

                var allImages = _.map(line.item.keyMapping_images,function(image){
                    return image.url
                })

                // If the item is matrix, we use that info instead of the parent info
                if (isMatrixItem && isSelectionComplete){
                    itemToSend = pdp.getSelectedMatrixChilds()[0];
                }
                
                

                // storedisplayname || storedisplayname2 || displayname
                var klaviyoObject = {
                    "ProductName": itemToSend.displayname || itemToSend.storedisplayname || itemToSend.storedisplayname2 ,
                    "ProductID" : itemToSend.internalid,
                    "SKU": itemToSend.keyMapping_sku,
                    "ImageURL":itemToSend.keyMapping_images.length > 0 ?itemToSend.keyMapping_images[0].url:"",
                    "URL":location.href,
                    "Price":itemToSend.keyMapping_price,
                    // "CompareAtPrice": line.item.keyMapping_comparePriceAgainst
                    
                };

                this.addCustomFields(itemToSend,parentItem,environment_component,klaviyoObject,isMatrixItem);

                // Sending always all the images available in custom attributes
                // IMG_1 to IMG_N
                _.each(allImages,function(image,i){
                    klaviyoObject["IMG_" + (i + 1).toString()] = image;
                    
                })

                // If it's a child Item, we have to modify the primary Image
                if (isMatrixItem && isSelectionComplete){
                    var multiImageOptions = environment_component.getConfig("tavanoKlaviyo").itemOptions;
                    
                    _.each(multiImageOptions,function(multiImageOption){
                        multiImageOptionValues.push(itemToSend[multiImageOption])
                    })
                    // Remove empty parameters
                    multiImageOptionValues = _.filter(multiImageOptionValues,function(value){return value});
                    var mainImage
                    // Now we only have to pick the Image from the entire list of images
                    
                    for (var i=0 ; i< allImages.length; i++){
                        var allCheck = true;
                        for (var j = 0; j < multiImageOptionValues.length; j++){
                            if (allImages[i] && allImages[i].toLowerCase().indexOf(multiImageOptionValues[j].toLowerCase())!= -1){
                                // mainImage = allImages[i];
                                
                            }else{
                                allCheck = false;
                            }
                        }

                        if (allCheck){
                            mainImage = allImages[i]
                        }
                    }

                    if (mainImage){
                        klaviyoObject["ImageURL"] = mainImage;
                    }else{
                        // If we didn't found the image, we assign the first that we can
                        if (allImages && allImages.length > 0)
                            klaviyoObject["ImageURL"] = allImages[0];

                    }
                }
                


                if (categories && categories.length > 0){
                    klaviyoObject["Categories"] = categories
                }
                

                var session = environment_component.getSession()

                // ---------------------------
                // SiteID and Domain
                // ---------------------------
                var siteId = environment_component.getConfig("siteSettings.siteid");
                var domain = location.protocol + "//" + location.host;

                klaviyoObject["site_id"] = siteId;
                klaviyoObject["domain"] = domain;
                
                // ---------------------------
                // Currency
                // ---------------------------
                var currency_code = session.currency.code;
                var currency_name = session.currency.currencyname
                var currency_symbol = session.currency.symbol
                

                klaviyoObject["currency_code"] = currency_code;
                klaviyoObject["currency_name"] = currency_name;
                klaviyoObject["currency_symbol"] = currency_symbol;
                
                // ---------------------------
                // Language
                // ---------------------------
                var language_name = session.language.name;
                klaviyoObject["language_name"] = language_name;

                // ---------------------------
                // Assigned Price Level ID
                // ---------------------------
                var price_levelInternalId = session.priceLevel;

                klaviyoObject["pricelevelID"] = price_levelInternalId;

                // ---------------------------
                // Add possible price level
                // ---------------------------
                this.addPossiblePriceLevels(line,session,klaviyoObject);
                


                var eventData = {
                    'event':'klaviyoProductViewed',
                    'klaviyo_data': klaviyoObject
                };

                window["dataLayer"].push(eventData);
            }
        },
        sendViewedItem : function(pdp,environment_component){
            var line = pdp.getItemInfo();
            var parentItem = line;
            
            if (!line)
                return

            var isMatrixItem = pdp.getAllMatrixChilds().length > 0;
            var isSelectionComplete = pdp.getSelectedMatrixChilds().length == 1;
            

            
            
            if (line){


                var categories ;
                var allImages = [];
                var itemToSend = line.item;
                var multiImageOptionValues = [];

                if (line.item.commercecategory && line.item.commercecategory.categories && line.item.commercecategory.categories.length > 0){
                    categories = _.map(line.item.commercecategory.categories,function(category){
                        return category.name
                    })
                }

                var allImages = _.map(line.item.keyMapping_images,function(image){
                    return image.url
                })


                // If the item is matrix, we use that info instead of the parent info
                if (isMatrixItem && isSelectionComplete){
                    itemToSend = pdp.getSelectedMatrixChilds()[0];
                }
                var klaviyoObject = {
                    "Title": itemToSend.itemid,
                    "ItemId": itemToSend.internalid,
                    "ImageURL":itemToSend.keyMapping_images.length > 0 ?itemToSend.keyMapping_images[0].url:"",
                    "Metadata": {
                        "Price": itemToSend.keyMapping_price,
                        // "CompareAtPrice": itemToSend.keyMapping_comparePriceAgainst
                    }
                };

                this.addCustomFields(itemToSend,parentItem,environment_component,klaviyoObject,isMatrixItem);


                // Sending always all the images available in custome attributes
                // IMG_1 to IMG_N
                _.each(allImages,function(image,i){
                    klaviyoObject["IMG_" + (i + 1).toString()] = image;
                    
                })

                // If it's a child Item, we have to modify the primary Image
                if (isMatrixItem && isSelectionComplete){
                    var multiImageOptions = environment_component.getConfig("tavanoKlaviyo").itemOptions;
                    
                    
                    _.each(multiImageOptions,function(multiImageOption){
                        multiImageOptionValues.push(itemToSend[multiImageOption])
                    })
                    // Remove empty parameters
                    multiImageOptionValues = _.filter(multiImageOptionValues,function(value){return value});
                    var mainImage
                    // Now we only have to pick the Image from the entire list of images
                    for (var i=0 ; i< allImages.length; i++){
                        var allCheck = true;
                        for (var j = 0; j < multiImageOptionValues.length; j++){
                            if (allImages[i] && allImages[i].toLowerCase().indexOf(multiImageOptionValues[j].toLowerCase())!= -1){
                                // mainImage = allImages[i];
                                
                            }else{
                                allCheck = false;
                            }
                        }

                        if (allCheck){
                            mainImage = allImages[i]
                        }
                    }

                    if (mainImage){
                        klaviyoObject["ImageURL"] = mainImage;
                    }else{
                        // If we didn't found the image, we assign the first that we can
                        if (allImages && allImages.length > 0)
                            klaviyoObject["ImageURL"] = allImages[0];

                    }
                }

                if (categories && categories.length > 0){
                    klaviyoObject["Categories"] = categories
                }

                var session = environment_component.getSession()
                
                // ---------------------------
                // Currency
                // ---------------------------
                var currency_code = session.currency.code;
                var currency_name = session.currency.currencyname
                var currency_symbol = session.currency.symbol
                

                klaviyoObject["currency_code"] = currency_code;
                klaviyoObject["currency_name"] = currency_name;
                klaviyoObject["currency_symbol"] = currency_symbol;
                
                // ---------------------------
                // Language
                // ---------------------------
                var language_name = session.language.name;
                klaviyoObject["language_name"] = language_name;

                // ---------------------------
                // Assigned Price Level ID
                // ---------------------------

                var price_levelInternalId = session.priceLevel;
                klaviyoObject["pricelevelID"] = price_levelInternalId;
                

                // ---------------------------
                // Add possible price level
                // ---------------------------
                this.addPossiblePriceLevels(line,session,klaviyoObject);

                var eventData = {
                    'event':'klaviyoViewedItem',
                    'klaviyo_data': klaviyoObject
                };

                window["dataLayer"].push(eventData);
            }
        }
    }

	return TavanoKlaviyoProductViewSync;
});


// @module Tavano.Klaviyo.Profile.Model
define(
	'Tavano.Klaviyo.Profile.Model'
,	[
		'Backbone'
	,	'underscore'
	,	'Utils'
	]
,	function (
		Backbone
	,	_
	,	Utils
	)
{
  return Backbone.Model.extend({

    url: function url ()
    {
      // var url = _.getAbsoluteUrl(getExtensionAssetsPath('services/QuestionsAndAnswers.Service.ss'));
        var urlRoot = Utils.getAbsoluteUrl(
					getExtensionAssetsPath(
							"services/KlaviyoProfile.Service.ss"
					)
			)

      return urlRoot;
    }
  })


});



define('Tavano.Klaviyo.Profile.Sync'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoProfileSync = {
        
        addProfile : function(profile,environment_component){
            
            if ( profile && profile.isloggedin){


                var session = environment_component.getSession()

                var price_levelInternalId = session.priceLevel;

                var loadScriptEventData = {
                    'event':'klaviyoLoadProfile',
                    'klaviyo_profile_data': {
                        "$email" : profile.email,
                        "$first_name" : profile.firstname,
                        "$last_name" : profile.lastname,
                        "pricelevelID" : price_levelInternalId
    
                    }
                };
                
                
                !window.isProfileLoaded && window["dataLayer"].push(loadScriptEventData);
                window.isProfileLoaded = true;
            }
        },
        addProfileFromService : function(profile){

            // If it's logged in
            if (profile && profile.email){

                var loadScriptEventData = {
                    'event':'klaviyoLoadProfile',
                    'klaviyo_profile_data': {
                        "$email" : profile.email,
                        "$first_name" : profile.firstname,
                        "$last_name" : profile.lastname
                    }
                };
                
                !window.isProfileLoaded && window["dataLayer"].push(loadScriptEventData);
                window.isProfileLoaded = true;
            }
            
        }
    }

	return TavanoKlaviyoProfileSync;
});


define('Tavano.Klaviyo.AddOrderSource.Checkout'
, [
    'Tavano.Klaviyo.OrderSource.View'
  ]
,   function
  (
    TavanoKlaviyoOrderSourceView
  )
{
  'use strict';


  var TavanoKlaviyoAddOrderSource = {

    addOrderSourceModule : function(checkout,environment_component){

        // // ----------------------------------------
        // // Add source origin to environment
        // // We allow up to 5 sites
        // // ----------------------------------------


        // var siteSource = environment_component.getConfig('Klaviyo.websource');
        
        
        

        // if (siteSource && siteSource.length > 0) 
        //     siteSource = siteSource[0]

        // var siteSourceValue;

        // switch(siteSource) {
        //     case "Site A":
        //         siteSourceValue = "1";
        //       break;
        //       case "Site B":
        //         siteSourceValue = "2";
        //       break;
        //       case "Site C":
        //         siteSourceValue = "3";
        //       break;
        //       case "Site D":
        //         siteSourceValue = "4";
        //       break;
        //       case "Site E":
        //         siteSourceValue = "5";
        //       break;
        //     default:
        //         siteSourceValue = "1";
        //   }

        // window.siteSource = siteSourceValue;


        // try{

        //     checkout.addModuleToStep(
        //         {
        //             step_url: 'opc'
        //             , module: {
        //                 id: 'TavanoKlaviyoOrderSourceView'
        //                 , index: 6
        //                 , classname: 'Tavano.Klaviyo.OrderSource.View'
        //             }
        //         });
        
        //         checkout.addModuleToStep(
        //         {
        //             step_url: 'review'
        //             , module: {
        //                 id: 'Tavano.KlaviyoOrderSourceView'
        //                 , index: 99
        //                 , classname: 'Tavano.Klaviyo.OrderSource.View'
        //             }
        //         });

        // }catch(e){

        // }
    }
 }


  return TavanoKlaviyoAddOrderSource

});




// @module Tavano.Klaviyo.Checkout.Profile.Model
define(
	'Tavano.Klaviyo.Checkout.Profile.Model'
,	[
		'Backbone'
	,	'underscore'
	,	'Utils'
	]
,	function (
		Backbone
	,	_
	,	Utils
	)
{
  return Backbone.Model.extend({

    url: function url ()
    {
      // var url = _.getAbsoluteUrl(getExtensionAssetsPath('services/QuestionsAndAnswers.Service.ss'));
        var urlRoot = Utils.getAbsoluteUrl(
					getExtensionAssetsPath(
							"services/KlaviyoProfile.Service.ss"
					)
			)

      return urlRoot;
    }
  })


});



define('Tavano.Klaviyo.Checkout.Sync.Checkout'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoCheckoutSync = {




		getParentImages : function(parentImages){

			var finalImagesProcessed = [];

			for (var prop in parentImages) {
				if (Object.prototype.hasOwnProperty.call(parentImages, prop)) {
					

					// Level 2

					for (var propLevel2 in parentImages[prop]) {
						if (Object.prototype.hasOwnProperty.call(parentImages[prop], propLevel2)) {
							
							if (propLevel2 == "url"){
								finalImagesProcessed.push(parentImages[prop][propLevel2])
								
							}else{


								// Level 3

								for (var propLevel3 in parentImages[prop][propLevel2]) {
								if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2], propLevel3)) {
									
									if (propLevel3 == "url"){

										finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3])
										
										}else{

											// Level 4

											for (var propLevel4 in parentImages[prop][propLevel2][propLevel3]) {
											if (Object.prototype.hasOwnProperty.call(parentImages[prop][propLevel2][propLevel3], propLevel4)) {
												
												if (propLevel4 == "url"){

													finalImagesProcessed.push(parentImages[prop][propLevel2][propLevel3][propLevel4])
													
													}else{
														// Add more levels nestede here

													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}


			return finalImagesProcessed;



		},

		addCustomFields : function(line,parentItem,environment_component,klaviyoObject,isMatrixChild){

			
			try{
				var customFields = environment_component.getConfig("tavanoKlaviyo").columns.customFields || [];

				_.each(customFields,function(customField){
					if (isMatrixChild && customField.nsidparent && customField.nsidparent != ""){
	
						klaviyoObject[customField.klaviyokey] = parentItem[customField.nsidparent]
	
					}else{
						
						if (customField && customField.nsid == "displayname"){
							klaviyoObject[customField.klaviyokey] = line.item.displayname
						}else{
							klaviyoObject[customField.klaviyokey] = line.item.extras[customField.nsid]
						}

					}
					
				})
			}catch(e){
				console.log("Impossible to add custom fields");
				console.log(JSON.stringify(e))
			}
        },
        
        sendCheckoutInfo: function(cart,environment_component){

			var self = this;

			var session = environment_component.getSession()
			

			var klaviyoObject = {};
			
			// ---------------------------
			// Currency
			// ---------------------------
			var currency_code = session.currency.code;
			var currency_name = session.currency.currencyname
			var currency_symbol = session.currency.symbol
			

			klaviyoObject["currency_code"] = currency_code;
			klaviyoObject["currency_name"] = currency_name;
			klaviyoObject["currency_symbol"] = currency_symbol;


			// ---------------------------
			// SiteID and Domain
			// ---------------------------
			var siteId = environment_component.getConfig("siteSettings.siteid");
			var domain = location.protocol + "//" + location.host;
			
			klaviyoObject["site_id"] = siteId;
			klaviyoObject["domain"] = domain;
			
			// ---------------------------
			// Language
			// ---------------------------
			var language_name = session.language.name;

			klaviyoObject["language_name"] = language_name;

			cart.getSummary().then(function(summary) {

				klaviyoObject["$event_id"] = Date.now().toString();
				klaviyoObject["$value"] = summary.total;
				klaviyoObject["items_subtotal"] = summary.subtotal;
				klaviyoObject["$CheckoutURL"] = location.href;
				
			});

			

			cart.getLines().then(function(lines) {


				var Items = [];
				
				_.each(lines,function(line,lineIndex){

					var dataLine = {
						"ProductID" : line.item.internalid,
						"SKU": line.item.extras.keyMapping_sku,
						"ProductName": line.item.extras.displayname || line.item.extras.storedisplayname || line.item.extras.storedisplayname2,
						"Quantity":line.quantity,
						"ItemPrice":line.rate,
						"RowTotal":line.amount,
						"ProductURL":klaviyoObject["domain"] + line.item.extras.keyMapping_url,
						"ImageURL":line.item.extras.keyMapping_images.length > 0 ?line.item.extras.keyMapping_images[0].url:"",
					}
					
					// Handle Images

					var matrixParent = line.item.extras.matrix_parent;
					
					self.addCustomFields(line,matrixParent,environment_component,dataLine,matrixParent)

					Items.push(dataLine)
					
					if (matrixParent){

						// In this case the all images are related to the child
						// var allImages = _.map(line.item.extras.keyMapping_images,function(image){
						// 	return image.url
						// })
						

						var allImages = self.getParentImages(matrixParent.itemimages_detail)

						var matrixOptionValues = [];
						_.each(line.options,function(option){
							if (option && option.isMatrixDimension && option.value)
								matrixOptionValues.push(option.value.label)
						})

						
						
						var mainImage
						// Now we only have to pick the Image from the entire list of images
						for (var i=0 ; i< allImages.length; i++){
							var allCheck = true;
							for (var j = 0; j < matrixOptionValues.length; j++){
								if (allImages[i].indexOf(matrixOptionValues[j])!= -1){
									
									
								}else{
									allCheck = false;
								}
							}

							if (allCheck){
								mainImage = allImages[i]
							}


						}
						
	
						if (mainImage){
							Items[lineIndex]["ImageURL"] = mainImage
						}else{
							// If we didn't found the image, we assign the first that we can
							if (allImages && allImages.length > 0)
								Items[lineIndex]["ImageURL"] = allImages[0];
	
						}
					}

					// End Handle Images

				})

				var ItemNames = _.map(Items,function(item){
					return item["ProductName"]
				})

				klaviyoObject["ItemNames"] = ItemNames;
				klaviyoObject["Items"] = Items;

				var eventData = {
					'event':'klaviyoStartedCheckout',
					'klaviyo_data': klaviyoObject
				};


				
				!window.checkoutStarted && window["dataLayer"].push(eventData);
				window.checkoutStarted = true;
				


			});

        }
       
    }

	return TavanoKlaviyoCheckoutSync;
});



define(
	'Tavano.Klaviyo.Klaviyo.Checkout'
,   [
		
		
		'Tavano.Klaviyo.LoaderSync.Checkout',
		'Tavano.Klaviyo.Checkout.Sync.Checkout',
		
		'Tavano.Klaviyo.Profile.Sync.Checkout',
		'Tavano.Klaviyo.AddOrderSource.Checkout',
		'Tavano.Klaviyo.Checkout.Profile.Model'
		
	]
,   function (
		
		TavanoKlaviyoLoaderSync,
		TavanoKlaviyoCheckoutSync,
		
		TavanoKlaviyoProfileSync,
		TavanoKlaviyoAddOrderSourceCheckout,
		TavanoKlaviyoCheckoutProfileModel
		
		
	)
{
	'use strict';



	return  {

		

	mountToApp: function mountToApp (container)
		{
			

			var userprofilecomponent = container.getComponent("UserProfile");
			var checkout = container.getComponent('Checkout');
			var cart = container.getComponent('Cart');
			var environment_component = container.getComponent("Environment");



			// ---------------------
			// Order Source
			// ---------------------
			
			TavanoKlaviyoAddOrderSourceCheckout.addOrderSourceModule(checkout,environment_component)



			// Manage Guest Checkout
			// Manage Login/Register
			checkout && checkout.on("afterShowContent", function() {


				if (userprofilecomponent){

					userprofilecomponent.getUserProfile().then(function(profile) {
					

						if (!window.isProfileLoaded && profile && profile.isloggedin){
							TavanoKlaviyoLoaderSync.addLoader()
						}
					});

				}else{

					// We might be in a version with no support for UserProfile Component
					var klaviyoProfileModel = new TavanoKlaviyoCheckoutProfileModel();
					klaviyoProfileModel.fetch().done(function(result){


						
						if (!window.isProfileLoaded && result && result.email){
							TavanoKlaviyoLoaderSync.addLoader()
						}
					})

				}

			})

			
			Backbone.on("KlaviyoLoaderCompleted",function(){

			

				setTimeout(function(){

					

					
					if (userprofilecomponent){

						// Add Profile
						userprofilecomponent.getUserProfile().then(function(profile) {
							
							TavanoKlaviyoProfileSync.addProfile(profile,environment_component);


							// ---------------------
							// Checkout Started
							// ---------------------
							
							
							if (checkout && profile && profile.isloggedin){

								setTimeout(function(){
									TavanoKlaviyoCheckoutSync.sendCheckoutInfo(cart,environment_component)
								}, 2000);
								
								
							}

						});

					}else{

						// We might be in a version with no support for UserProfile Component
						var klaviyoProfileModel = new TavanoKlaviyoCheckoutProfileModel();
						klaviyoProfileModel.fetch().done(function(result){


							TavanoKlaviyoProfileSync.addProfileFromService(result);


							// ---------------------
							// Checkout Started
							// ---------------------
							
							
							if (checkout && result && result.email){
								
								setTimeout(function(){
									TavanoKlaviyoCheckoutSync.sendCheckoutInfo(cart,environment_component)
								}, 2000);
								
							}


						})
					}

					
				}, 2000);

			})

			// ---------------------
			// Load Script
			// ---------------------
			
			TavanoKlaviyoLoaderSync.addLoader()

		}
	};
});



define('Tavano.Klaviyo.LoaderSync.Checkout'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoLoaderSync = {
        
        addLoader : function(){
            
            
            var loadScriptEventData = {
                'event':'klaviyoLoadScript',
                'klaviyo_data': {}
            };
            !window.loaderCompleted && window["dataLayer"].push(loadScriptEventData);
            window.loaderCompleted = true;

            Backbone.trigger("KlaviyoLoaderCompleted")
            
        }
    }

	return TavanoKlaviyoLoaderSync;
});


define('Tavano.Klaviyo.OrderSource.View'
, [
    'Wizard.Module'

  , 'tavano_klaviyo_klaviyoordersource.tpl'
  ]
, function (
    WizardModule

  , tavano_klaviyo_klaviyoordersource
  )
{
  'use strict';

  return WizardModule.extend({

    template: tavano_klaviyo_klaviyoordersource,

   
    

   getContext: function getContext()
    {
      try{
          
        // if (this && this.model){
        //   var wizardModule = this.model;
        //   var options = wizardModule.get('options');
          

        //   options.custbody_tt_klaviyo_order_source = window.siteSource;

        //   wizardModule.set('options',options);
        // }
          
      }catch(e){
          // console.log("Klaviyo Error trying to set order source: ");
          console.log(e);
      }
        
      return {};
    }
  });
});


define('Tavano.Klaviyo.Profile.Sync.Checkout'
,	[
]
,	function (
	
	)
{
    'use strict';
    

	var TavanoKlaviyoProfileSync = {
        
        addProfile : function(profile,environment_component){
            
            if ( profile && profile.isloggedin){


                var session = environment_component.getSession()

                var price_levelInternalId = session.priceLevel;

                var loadScriptEventData = {
                    'event':'klaviyoLoadProfile',
                    'klaviyo_profile_data': {
                        "$email" : profile.email,
                        "$first_name" : profile.firstname,
                        "$last_name" : profile.lastname,
                        "pricelevelID" : price_levelInternalId
    
                    }
                };
                
                
                !window.isProfileLoaded && window["dataLayer"].push(loadScriptEventData);
                window.isProfileLoaded = true;
            }
        },
        addProfileFromService : function(profile){

            // If it's logged in
            if (profile && profile.email){

                var loadScriptEventData = {
                    'event':'klaviyoLoadProfile',
                    'klaviyo_profile_data': {
                        "$email" : profile.email,
                        "$first_name" : profile.firstname,
                        "$last_name" : profile.lastname
                    }
                };
                
                !window.isProfileLoaded && window["dataLayer"].push(loadScriptEventData);
                window.isProfileLoaded = true;
            }
            
        }
    }

	return TavanoKlaviyoProfileSync;
});


// Model.js
// -----------------------
// @module Case
define("Tavano.Klaviyo.KlaviyoProfile.Model", ["Backbone", "Utils"], function(
    Backbone,
    Utils
) {
    "use strict";

    // @class Case.Fields.Model @extends Backbone.Model
    return Backbone.Model.extend({

        
        //@property {String} urlRoot
        urlRoot: Utils.getAbsoluteUrl(
            getExtensionAssetsPath(
                "services/KlaviyoProfile.Service.ss"
            )
        )
        
});
});



define(
	'Tavano.Klaviyo.Klaviyo'
,   [
		'Tavano.Klaviyo.Cart.Sync',
		'Tavano.Klaviyo.ProductView.Sync',
		'Tavano.Klaviyo.LoaderSync',
		'Tavano.Klaviyo.Order.Sync',
		'Tavano.Klaviyo.Profile.Sync',
		'Tavano.Klaviyo.Profile.Model'
	]
,   function (
		TavanoKlaviyoCartSync,
		TavanoKlaviyoProductViewSync,
		TavanoKlaviyoLoaderSync,
		TavanoKlaviyoOrderSync,
		TavanoKlaviyoProfileSync,
		TavanoKlaviyoProfileModel
		
	)
{
	'use strict';



	return  {

		

	mountToApp: function mountToApp (container)
		{

			if (SC.isPageGenerator())
				return
			

			var userprofilecomponent = container.getComponent("UserProfile");
			
			var cart = container.getComponent('Cart');
			var pdp = container.getComponent('PDP');
			var layout = container.getComponent('Layout');
			
			
			var environment_component = container.getComponent("Environment");


			// ---------------------
			// Order Submission
			// ---------------------
			TavanoKlaviyoOrderSync.sendOrderDetailsInfo(cart,userprofilecomponent)


			// ---------------------
			// Add To Cart
			// ---------------------
			
			cart.on("afterAddLine",function(){
				TavanoKlaviyoCartSync.sendAddLineEvent(cart,environment_component)
			})


			// ---------------------
			// Update Line
			// ---------------------
			
			cart.on("afterUpdateLine",function(){
				TavanoKlaviyoCartSync.sendUpdateLineEvent(cart,environment_component)
			})

			// ---------------------
			// Remove Line
			// ---------------------
			
			cart.on("afterRemoveLine",function(){
				TavanoKlaviyoCartSync.sendUpdateLineEvent(cart,environment_component)
			})


			Backbone.on("KlaviyoLoaderCompleted",function(){

			

				setTimeout(function(){

					
					

					if (userprofilecomponent){
						// Add Profile
						userprofilecomponent.getUserProfile().then(function(profile) {
							TavanoKlaviyoProfileSync.addProfile(profile,environment_component);
						});
					}else{

						// We might be in a version with no support for UserProfile Component
						var klaviyoProfileModel = new TavanoKlaviyoProfileModel();
						klaviyoProfileModel.fetch().done(function(result){
							TavanoKlaviyoProfileSync.addProfileFromService(result);
						})

					}
					
				}, 2000);

				

				layout.on('afterShowContent', function() {

					

					if (pdp){

						TavanoKlaviyoProductViewSync.sendProductDetailsInfo(pdp,environment_component);
						TavanoKlaviyoProductViewSync.sendViewedItem(pdp,environment_component);

						pdp.on('afterOptionSelection', function(event) {
							
							TavanoKlaviyoProductViewSync.sendProductDetailsInfo(pdp,environment_component);
							TavanoKlaviyoProductViewSync.sendViewedItem(pdp,environment_component);
							return true
						})
						
					}
					
				});

			})

			// ---------------------
			// Load Script
			// ---------------------
			
			TavanoKlaviyoLoaderSync.addLoader()

		}
	};
});


};

extensions['ACS.RemoveOptionsPusher.1.0.0'] = function(){

function getExtensionAssetsPath(asset){
return 'extensions/ACS/RemoveOptionsPusher/1.0.0/' + asset;
};

define('ACS.RemoveOptionsPusher.RemoveOptionsPusher', [
], function RemoveOptionsPusherMobile(
) {
    'use strict';

    return {
        mountToApp: function mountToApp(container) {
            var layout = container.getComponent('Layout');

            layout.addToViewContextDefinition('ProductDetails.Options.Selector.View', 'showPusher', 'boolean', function RemovePusher() {
                return false;
            });
        }
    };
});


};

try{
	extensions['ACS.BadgesFixPLP.1.0.0']();
	SC.addExtensionModule('ACS.BadgesFixPLP.BadgesFix');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['SuiteCommerce.ItemBadges.1.1.3']();
	SC.addExtensionModule('SuiteCommerce.ItemBadges.EntryPoint');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['ACS.B2CEmbroideryValidation.4.0.0']();
	SC.addExtensionModule('EmbroideryValidation.Main');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['Kodella.KDClearCart.1.0.0']();
	SC.addExtensionModule('Kodella.KDClearCart.KDClearCart');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['ACS.HomeBanner.1.0.6']();
	SC.addExtensionModule('HomeBanner');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['Kodella.KDGlobalExtension.1.1.0']();
	SC.addExtensionModule('Kodella.KDGlobalExtension.KDGlobalExtension');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['ACS.Embroidery.4.0.0']();
	SC.addExtensionModule('ACS.Embroidery.Main');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['Kodella.KDStockGlobal.1.3.0']();
	SC.addExtensionModule('Kodella.KDStockGlobal.KDStockGlobal');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['Kodella.KDStrikethrough.1.0.0']();
	SC.addExtensionModule('Kodella.KDStrikethrough.KDStrikethrough');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['NetSuite.Slideshow.1.0.2']();
	SC.addExtensionModule('NetSuite.Slideshow.SlideshowModule');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['Tavano.Klaviyo.3.0.6']();
	SC.addExtensionModule('Tavano.Klaviyo.Klaviyo');
}
catch(error)
{
	console.error(error)
}

try{
	extensions['ACS.RemoveOptionsPusher.1.0.0']();
	SC.addExtensionModule('ACS.RemoveOptionsPusher.RemoveOptionsPusher');
}
catch(error)
{
	console.error(error)
}


SC.ENVIRONMENT.EXTENSIONS_JS_MODULE_NAMES = ["ACS.BadgesFixPLP.BadgesFix","SuiteCommerce.ItemBadges.Configuration","SuiteCommerce.ItemBadges.Instrumentation.FallbackLogger","SuiteCommerce.ItemBadges.Instrumentation.MockAppender","SuiteCommerce.ItemBadges.Instrumentation.Collection","SuiteCommerce.ItemBadges.Instrumentation.Model","SuiteCommerce.ItemBadges.Instrumentation.InstrumentationHelper","SuiteCommerce.ItemBadges.Instrumentation.Logger","SuiteCommerce.ItemBadges.BadgesList.View","SuiteCommerce.ItemBadges.Collection","SuiteCommerce.ItemBadges.GlobalViews","SuiteCommerce.ItemBadges.Model","SuiteCommerce.ItemBadges.ProductDetail","SuiteCommerce.ItemBadges.ProductList","SuiteCommerce.ItemBadges.View","SuiteCommerce.ItemBadges.EntryPoint","EmbroideryValidation.Main","Kodella.KDClearCart.KDClearCart.View","Kodella.KDClearCart.KDClearCart.Model","Kodella.KDClearCart.KDClearCart.SS2Model","Kodella.KDClearCart.KDClearCart","HomeBanner.View","HomeBanner","Kodella.KDGlobalExtension.KDGlobalExtension.View","Kodella.KDGlobalExtension.KDGlobalExtension.Model","Kodella.KDGlobalExtension.KDGlobalExtension.SS2Model","Kodella.KDGlobalExtension.KDGlobalExtension","ACS.Embroidery.CartManager","ACS.Embroidery.Item.Model","ACS.Embroidery.Main.Model","ACS.Embroidery.Main","ACS.Embroidery.Main.View","Kodella.KDStockGlobal.KDStockGlobal","Kodella.KDStrikethrough.KDStrikethrough.View","Kodella.KDStrikethrough.KDStrikethrough.Model","Kodella.KDStrikethrough.KDStrikethrough.SS2Model","Kodella.KDStrikethrough.KDStrikethrough","jQuery.bxSlider@4.2.14","SuiteCommerce.Slideshow.Common.Utils","NetSuite.Slideshow.SlideshowCCT","NetSuite.Slideshow.SlideshowCCT.Collection","NetSuite.Slideshow.SlideshowCCT.Model","NetSuite.Slideshow.SlideshowCCT.View","NetSuite.Slideshow.SlideshowModule","Tavano.Klaviyo.Cart.Sync","Tavano.Klaviyo.Checkout.Sync","Tavano.Klaviyo.Klaviyo","Tavano.Klaviyo.LoaderSync","Tavano.Klaviyo.Order.Sync","Tavano.Klaviyo.ProductView.Sync","Tavano.Klaviyo.Profile.Model","Tavano.Klaviyo.Profile.Sync","Tavano.Klaviyo.AddOrderSource.Checkout","Tavano.Klaviyo.Checkout.Profile.Model","Tavano.Klaviyo.Checkout.Sync.Checkout","Tavano.Klaviyo.Klaviyo.Checkout","Tavano.Klaviyo.LoaderSync.Checkout","Tavano.Klaviyo.OrderSource.View","Tavano.Klaviyo.Profile.Sync.Checkout","Tavano.Klaviyo.KlaviyoProfile.Model","ACS.RemoveOptionsPusher.RemoveOptionsPusher"];
