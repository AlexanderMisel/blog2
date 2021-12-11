# 深入了解Ace Editor的mode

Ace Editor是一款非常有名的基于Web的源代码编辑器，具有丰富的可扩展性，而且性能也很棒，处理上百万行代码不在话下。据我所知，维基百科、可汗学院、Overleaf、CodeCombat等知名网站都在使用这款编辑器。不过，它也有一个大问题就是文档写得非常简陋。

Ace Editor用来支持语法高亮的资源文件称作language mode（语言模式），Ace提供了扩展自定义语言mode的方法[^modedoc]，但根据这个文档去看很多现有的mode都会一头雾水，因为有很多用法在文档里一个字都没有写。不过在本文中，我会把我阅读Ace代码了解到的东西都分享给大家，这样大家就不用再读一遍代码了。

[^modedoc]: https://ace.c9.io/#nav=higlighter

## 最基本的mode用法

还是从文档里已经介绍的基本用法讲起。每个mode都会把它包含的所有规则放在`this.$rules`之中。这些规则每个用一个数组表示。虽然格式相同，但是有一个地位特殊，那就是`start`这条规则，它是整个规则集的入口。

```js
this.$rules = {
    start: [
        { token: t1, regex: r1, next: n1 },
        { token: t2, regex: r2, next: n2 }
    ],
    t1: [ ... ],
    t2: [ ... ],
};
```

每条规则的数组就类似于PEG中的**有序选择**，排在前面的规则优先，而且前面匹配成功就不会检查后面的规则。`token`一般是一个数组，在经过`regex`匹配过后所有的捕获会按照顺序对应上`token`里面的每一项。`next`表示下一个状态（规则），如果不指定`next`的话，则会返回`start`规则。

我们可以简单地利用基本用法来识别一下MediaWiki中的标题

```js
{
    start: [ 'heading' ],
    heading: [{
        token: [
            "punctuation.definition.heading",
            "entity.name.section",
            "punctuation.definition.heading"
        ],
        regex: /(={1,6})(.+?)(\1)(?!=)/
    }],
};
```

## 官方文档未提到的用法

几乎大部分我们接下来要介绍的用法都是在`text_highlight_rules.js`这个mode中实现的。这个mode应该算是一种meta mode，并非针对一种语言。而是几乎所有语言都理所当然地要继承这个mode。更准确地，是通过`this.normalizeRules`这个函数来实现的。

### push与pop

可以发现很多现有的mode都使用了这个特性。那么它是做什么的呢？从名字我们就可以大概猜出来，应该是实现了一个stack。那么什么情况下会用到这个特性呢？通常在用来保证语法的开始与结束能够配对的时候需要用。就比如在MediaWiki中模板定义文法中的模板参数的fallback链，就需要用到。

```mediawiki
{{{ 123 | test{{{456}}}xasd }}}
```

为了能让内部参数456的结尾`}}}`不会被误认为结束外部参数123，我们这里就要在每次开启参数的时候push进去一个state，每次关闭参数的时候pop一下，这样就不会造成内部关闭外部的情形了。实际写出来大概就是这样：

```js
{
    start: [ 'argument' ],
    argument: [{
        stateName: 'openArg',
        token: [
            "variable.parameter", "text", "variable.other",
            "text", "keyword.operator"
        ],
        regex: /({{{)(\s*)(\w+)(\s*)((?:\|)?)/,
        push: [{
            token: "variable.parameter",
            regex: /}}}/,
            next: "pop"
        }, 'start']
    }]
}
```

在Ace中push是用一个数组来表示的，比较反直观，而且`push`实际上也隐含`next`的意味。上面定义的规则的意思是说，我这个`openArg`啊，它要push到stack里，同时它的下一条状态就是push里面这个数组（因为在Ace里面，就是用数组来表示rule）。

那好啦，到了下一个状态的时候，它就会按照顺序，先匹配`}}}`这条规则，一旦匹配上，那就会调用pop，也就意味着要跳出内部这个argument了。那么为什么还要加一个`start`呢？这个的作用是说，我argument内部是要按照start规则来匹配的，放到MediaWiki里意思就是说，我模板参数的fallback可以是任何wikitext，当然也能包含另一个模板参数啦。

### 其他特性

- `include`指令：用来引用`$rules`中定义好的规则，但我更推荐直接用规则的名字引用，如上面`push`里面的`start`。很多从tmLanguage文件会包含一个`include: '$self'`的写法，这个写法经我验证在Ace中无效，应当改为对`start`的引用
- `defaultToken`指令：意思就是不管匹配到啥都按这个token处理，等价于
  ```js
  { token: 'defaultToken', regex: /.+/ }
  ```
- `caseInsensitive`指令，用来让regex互略大小写区别
- `onMatch`指令，这个指令是一个函数，其返回值将作为`token`使用。`onMatch`接收的参数分别是value, currentState, stack, line，它的`value`参数能够提供正则表达式匹配结果中的每个捕获。事实上这个指令本来是原来`token`传函数的情况，但由于作者修改代码的时候忽视了文档这部分，于是将原有功能改为用`onMatch`实现。[^issue1269]
- `rules`指令所做的事是这样的：对于它内部的规则，如果全局`$rules`没这条规则，那么就把它赋给全局；如果没有呢，就用里面的push函数刷一遍全局的`$rules`。说实话我也没搞懂具体是用来做什么的。这个指令使用得很少，目前只有ruby、sh和crystal三个mode在用。

[^issue1269]: https://github.com/ajaxorg/ace/issues/1269

## 结语

在弄清Ace Editor的文档未写清的特性之后，Ace Editor就变为了一个容易扩展语言的一个编辑器，并且性能还不错。在扩展语言mode的方式方面，其他JS代码编辑器（如CodeMirror）也大同小异。

这篇文章我想要达到的作用就是，把这些重要的参数介绍给大家，让大家至少能够看懂已经有的这些mode是在做什么。因为我发现在我弄懂，写这篇文章之前，我真的看不懂它那些push、pop是什么意思，到底为啥rule是写成数组形式等等。当然这也反映出写好文档的重要性。[∎](../ "返回首页")