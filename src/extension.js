const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { Gio, GLib, St, Clutter, GObject } = imports.gi;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Search = imports.ui.search;
const ByteArray = imports.byteArray;

const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;


function init() {
  log(`Initializing ${Me.metadata.name}`);
  return new Extension();
}

var ShortListSearchResult = GObject.registerClass(
  class ShortListSearchResult extends Search.SearchResult {
    _init(provider, metaInfo, resultsView) {
      super._init(provider, metaInfo, resultsView);

      this.style_class = 'list-search-result';

      let content = new St.BoxLayout({
        style_class: 'list-search-result-content',
        vertical: true,
      });
      this.set_child(content);

      let titleBox = new St.BoxLayout({
        style_class: 'list-search-result-title',
        vertical: true,
        x_expand: true,
        x_align: Clutter.ActorAlign.FILL,
      });

      content.add_child(titleBox);

      let title = new St.Label({
        text: this.metaInfo['name'],
        style: 'font-weight: bold',
        x_expand: true,
      });
      titleBox.add_child(title);
      let definition = new St.Label({
        text: this.metaInfo['definition'],
        x_expand: true,
      });
      titleBox.add_child(definition);

      this.label_actor = title;
    }

    get ICON_SIZE() {
      return 24;
    }
  });

class Extension {
  constructor() { }

  enable() {
    log(`Enabling ${Me.metadata.name}`);
    this.instance = new SearchProvider();
    const _searchResults = getOverviewSearchResult();
    if (_searchResults._searchSystem) {
      _searchResults._searchSystem.addProvider(this.instance);
    } else {
      _searchResults._registerProvider(this.instance);
    }
  }

  disable() {
    log(`Disabling ${Me.metadata.name}`);
    const _searchResults = getOverviewSearchResult()._searchResults;
    if (_searchResults._searchSystem) {
      _searchResults._searchSystem._unregisterProvider(this.instance);
    } else {
      _searchResults._unregisterProvider(this.instance);
    }
    this.instance = null;
  }
}


function getOverviewSearchResult() {
  if (Main.overview.viewSelector !== undefined) {
    return Main.overview.viewSelector._searchResults;
  } else {
    return Main.overview._overview.controls._searchController._searchResults;
  }
}


class SearchProvider {

  constructor() {
    this.clipboard = St.Clipboard.get_default();
    this.appIcon = Gio.ThemedIcon.new_with_default_fallbacks('org.gnome.Dictionary');
  }

  canLaunchSearch = false
  id = Me.uuid
  appInfo = {
    get_name: () => 'Dictionary',
    get_icon: () => this.appIcon,
    get_id: () => `dictionary-search-provider`,
    should_show: () => true,
  }

  getInitialResultSet(terms, cancellable = null) {
    return new Promise((resolve, reject) => {
      const word = terms.splice(1).join(' ');

      if (!['def', 'define', 'definition'].includes(terms[0]) || word.length == 0) {
        resolve([]);
        return;
      }

      // let [ok, out, err, exit] = GLib.spawn_command_line_sync(`dict -C -d wn --match ${word}`);
      // const words = ByteArray.toString(out).split(/\s+/).splice(1);

      // resolve(words);

      resolve([word])
    })
  }

  getSubsearchResultSet(_, terms, cancellable = null) {
    return this.getInitialResultSet(terms);
  }

  getResultMetas(results, cancellable = null) {
    return new Promise((resolve, reject) => {
      const metas = []

      for (const result of results) {

        const [ok, out, err, exit] = GLib.spawn_command_line_sync(`dict -d wn ${result}`);
        const error = ByteArray.toString(err);

        if (error !== '') {
          const suggestions = error.split('\n').splice(1).join(' ').split(/\s+/).splice(1).join(', ');

          metas.push({
            id: result,
            name: result,
            definition: `Did you mean ${suggestions}`,
          });
        } else {
          const definition = ByteArray.toString(out);
          metas.push({
            id: result,
            name: result,
            definition: definition.split('\n').slice(5).join('\n'),
          });
        }
      };

      resolve(metas);
    });
  }

  activateResult(result, terms) {
    Util.spawn(['gnome-dictionary', '--lookup', result])
  }

  filterResults(providerResults, maxResults) {
    return providerResults.slice(0, maxResults);
  }

  createResultObject(meta) {
    // return null;
    // return new Search.GridSearchResult(provider, metaInfo, getMainOverviewViewSelector()._searchResults);
    return new ShortListSearchResult(this, meta, getOverviewSearchResult()._searchResults);
  }
}
