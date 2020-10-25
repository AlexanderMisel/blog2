// CJK is short for Chinese, Japanese, and Korean.
//
// CJK includes following Unicode blocks:
// \u2e80-\u2eff CJK Radicals Supplement
// \u2f00-\u2fdf Kangxi Radicals
// \u3040-\u309f Hiragana
// \u30a0-\u30ff Katakana
// \u3100-\u312f Bopomofo
// \u3200-\u32ff Enclosed CJK Letters and Months
// \u3400-\u4dbf CJK Unified Ideographs Extension A
// \u4e00-\u9fff CJK Unified Ideographs
// \uf900-\ufaff CJK Compatibility Ideographs
//
// For more information about Unicode blocks, see
// http://unicode-table.com/en/
// https://github.com/vinta/pangu
//
// all J below does not include \u30fb
const CJK = '\u2e80-\u2eff\u2f00-\u2fdf\u3040-\u309f\u30a0-\u30fa\u30fc-\u30ff\u3100-\u312f\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff';

// ANS is short for Alphabets, Numbers, and Symbols.
//
// A includes A-Za-z\u0370-\u03ff
// N includes 0-9
// S includes `~!@#$%^&*()-_=+[]{}\|;'",<.>/?
//
// some S below does not include all symbols

const ANY_CJK = new RegExp(`[${CJK}]`);

// the symbol part only includes + - * / = & | < >
const CJK_OPERATOR_ANS = new RegExp(`([${CJK}])([\\+\\-\\*\\/=&\\|<>])([A-Za-z0-9])`, 'g');
const ANS_OPERATOR_CJK = new RegExp(`([A-Za-z0-9])([\\+\\-\\*\\/=&\\|<>])([${CJK}])`, 'g');

const FIX_SLASH_AS = /([/]) ([a-z\-_\./]+)/g;
const FIX_SLASH_AS_SLASH = /([/\.])([A-Za-z\-_\./]+) ([/])/g;

const CJK_ANS = new RegExp(`([${CJK}])([A-Za-z\u0370-\u03ff0-9@\\$%\\^&\\*\\-\\+\\\\=\\|/\u00a1-\u00ff\u2150-\u218f\u2700—\u27bf])`, 'g');
const ANS_CJK = new RegExp(`([A-Za-z\u0370-\u03ff0-9~\\$%\\^&\\*\\-\\+\\\\=\\|/!;,\\.\\?\u00a1-\u00ff\u2150-\u218f\u2700—\u27bf])([${CJK}])`, 'g');

const S_A = /(%)([A-Za-z])/g;

class Pangu {
  spacing(text) {
    if (typeof text !== 'string') {
      console.warn(`spacing(text) only accepts string but got ${typeof text}`); // eslint-disable-line no-console
      return text;
    }

    if (text.length <= 1 || !ANY_CJK.test(text)) {
      return text;
    }

    const self = this;

    // DEBUG
    // String.prototype.rawReplace = String.prototype.replace;
    // String.prototype.replace = function(regexp, newSubstr) {
    //   const oldText = this;
    //   const newText = this.rawReplace(regexp, newSubstr);
    //   if (oldText !== newText) {
    //     console.log(`regexp: ${regexp}`);
    //     console.log(`oldText: ${oldText}`);
    //     console.log(`newText: ${newText}`);
    //   }
    //   return newText;
    // };

    let newText = text;

    newText = newText.replace(CJK_OPERATOR_ANS, '$1\u2005$2\u2005$3');
    newText = newText.replace(ANS_OPERATOR_CJK, '$1\u2005$2\u2005$3');

    newText = newText.replace(FIX_SLASH_AS, '$1$2');
    newText = newText.replace(FIX_SLASH_AS_SLASH, '$1$2$3');

    newText = newText.replace(CJK_ANS, '$1\u2005$2');
    newText = newText.replace(ANS_CJK, '$1\u2005$2');

    newText = newText.replace(S_A, '$1\u2005$2');
    // DEBUG
    // String.prototype.replace = String.prototype.rawReplace;

    return newText;
  }
}

const pangu = new Pangu();

(function() {
  'use strict';

  var traverse = function (node) {
    var childNodes = node.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      var childNode = childNodes[i];
      if (childNode.nodeType === Node.TEXT_NODE) {
        childNode.data = pangu.spacing(childNode.data);
        if (i === 0) {
          var previousSibling = node.previousSibling;
          if (previousSibling && previousSibling.nodeType === Node.TEXT_NODE) {
            var testText = previousSibling.data.substr(-1) + childNode.data.charAt(0);
            var testNewText = pangu.spacing(testText);
            if (testText !== testNewText) {
              previousSibling.data += '\u2005';
            }
          }
        }
        if (i + 1 === childNodes.length) {
          var nextSibling = node.nextSibling;
          if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
            var testText = childNode.data.substr(-1) + nextSibling.data.charAt(0);
            var testNewText = pangu.spacing(testText);
            if (testText !== testNewText) {
              nextSibling.data = '\u2005' + nextSibling.data;
            }
          }
        }
      } else if (childNode.nodeName !== 'PRE' && childNode.nodeName !== 'CODE') {
        traverse(childNode);
      }
    }
  }

  traverse(document.getElementById('write'));
})();
