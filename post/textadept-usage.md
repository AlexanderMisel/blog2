# Textadept使用心得

前一篇博客里我向大家推荐了Textadept。这篇里我来谈谈我的Textadept使用心得。以方便大家日常使用Textadept。

我们知道Textadept是跨平台的，图形界面基于GTK+。不管是Lua也好，GTK+也好，用过的人相信都会觉得它们在Linux上跑得更顺。所以Textadept要想配好，在Win下要做的配置要比Linux多一点点。这些是由于Win下路径也好，文件也好，都喜欢用一种反人类的gbk系列编码。路径还要用反斜杠，如果消灭反斜杠的路径的话，编程将会编得多么容易啊（无端联想）。

## 增加编码

刚刚提到了编码的问题，我就先说这一点。Textadept出于极简、效率之类的考虑，没有像一些其他编辑器那样，把所有可能的编码都列到它的表里。只列了一些拉丁语系常用的编码。对于常用UTF-8的Linux来说可能很久才会察觉，但是在Windows上经常会遇到其他编码。为了支持gbk编码，我们需要在`core/file_io.lua`的`io.encodings`里面加上gbk。加上之后你就会发现，打开gbk编码的文件不崩溃了。

## 更改字体

在Linux下我们可能也体会不到，那就是在Win下中文很可能会显示不出来。既然编码对了，那么为啥还是显示不出来呢？原因就在于Textadept给代码使用的字体是直接拿的GTK+的默认monospace字体，在Win下可能就是Courier New，但是这就出事了，这个字体没有汉字。那为什么其他编辑器显示得Courier New好好的呢？原因是他们查了系统的后备字体，但Textadept因为极简，当然不肯查了，所以我们要手动配。最简单的方式就是直接在`~/.textadept/init.lua`里面第一行配主题的时候顺便配上一个中英文通吃的字体，比如文泉驿等宽微米黑，如下：

```lua
buffer:set_theme('light', {font = 'WenQuanYi Micro Hei Mono'})
```

但是其实还有一个地方可能需要设置，那就是界面菜单的字体。Win下如果你看到的是宋体的菜单的话，那应该没有显示不出来的字符，不过很丑；如果你看到的是雅黑的话，你有一定可能会看到有些字符显示不出来，显示不出来的话，你可以按照我下面说的做。修改`share/themes/MS-Windows/gtk-2.0/gtkrc`文件，在最底下加这些

```cpp
style "wqyfont"
{
  font_name = "WenQuanYi Micro Hei 10"
}
widget "*" style "wqyfont"
```

## 引入模块

你要用别人的扩展，或者自己写扩展，势必要引入模块的。绝对不要把所有代码都写到一个init.lua里面。Lua引入模块的方式很简单：

```lua
_M.file_browser = require('file_browser')
```

简单地require一下就好了。有人说Lua像JavaScript，我也这么觉得。一些JavaScript编程的感觉都可以借鉴过来。未避免大家重复造轮子，这个[Wiki](https://foicica.com/wiki/textadept)你们是一定要看的。最好还要订阅一下Textadept的邮件列表。Mitchell还是一个很热心的人的，基本上我问的问题他都解答了。

语言模块相信是大家用得最多的。它为大家提供的是语言的自动补全、快捷键以及片段（snippets）等。除了这些，我还用到的有folding（代码折叠）、File Browser（文件浏览器）等。

## 模式匹配

如果你没用过Lua的话，我觉得可能最让你陌生的就是Lua的模式匹配了吧。Textadept很奇葩地在不同地方用了三种不同的模式匹配方案。当然你如果抱着学习的态度的话，对你更多的可能是帮助吧。下面我来说说这三种模式匹配：

- Lua原生的模式匹配。大部分地方作者都是用的这套方案。常见的匹配没问题的，就是和常用的正则表达式有比较大区别，但总体上语法还是类似的。如果不熟悉可以看看[官方文档](https://cloudwu.github.io/lua53doc/manual.html#6.4.1)或者[Textadept的手册](https://foicica.com/textadept/manual.html#Lua.Patterns)。
- LPeg。LPeg可以说是相当强大的，也会给你完全不一样的体验。我感觉LPeg用起来的灵活性比较好，有编程感。再Textadept中把LPeg用在了词法解析器（lexer）中。不过lexer数量蛮多的，难免有些lexer实现不是太好或者搞出来不太好看的，希望大家能够顺手改进。
- EcmaScript风格的标准正则表达式。用于界面上的搜索、替换等。源码里面是通过调用Scintilla的搜索函数实现的。这也带来了一点弊端，Scintilla不允许匹配换行符（`\r`和`\n`）；其实原来Textadept也是使用Lua模式匹配搜索的，但是新版本换掉了，想用Lua模式匹配的可以考虑试试[这个](https://foicica.com/wiki/lua-pattern-find)。

## 代码格式化

缩进大小相关的转换可以不用任何外部工具解决。只要你使用的语言是设置好缩进的，比如2个空格缩进，你只要把4个空格的文件复制过来，自动就会变成2个空格。

更专业的格式化就需要借助外部工具了。我这里举两个简单的例子：json和html。由于python有现成的json模块，不用白不用，所以就借用过来了，不过我还是做了点改动

```python
import argparse
import json
import sys

reload(sys)
sys.setdefaultencoding('utf-8')

def main():
    prog = 'python jsontool.py'
    description = ('A simple command line interface for json module '
                     'to validate and pretty-print JSON objects.')
    parser = argparse.ArgumentParser(prog=prog, description=description)
    parser.add_argument('infile', nargs='?', type=argparse.FileType(),
                        help='a JSON file to be validated or pretty-printed')
    parser.add_argument('outfile', nargs='?', type=argparse.FileType('w'),
                        help='write the output of infile to outfile')
    parser.add_argument('--sort-keys', action='store_true', default=False,
                        help='sort the output of dictionaries alphabetically by key')
    options = parser.parse_args()

    infile = options.infile or sys.stdin
    outfile = options.outfile or sys.stdout
    sort_keys = options.sort_keys
    with infile:
        try:
            obj = json.load(infile)
        except ValueError as e:
            raise SystemExit(e)
    with outfile:
        json.dump(obj, outfile, sort_keys=sort_keys, indent=2, ensure_ascii=False)
        outfile.write('\n')

if __name__ == '__main__':
    main()
```

改过之后其实在终端就可以了完成格式化了。但是想要再懒一点，在Textadept里面就完成操作的话，就需要Filter through功能了。我翻译界面文字的时候，不知道这个翻译成什么好，所以就保留了英文。使用Filter through功能也可以通过快捷键<kbd>Ctrl</kbd>+<kbd>|</kbd>完成，在下面的命令框输入

```bash
python jsontool.py
```

然后你就会看到完美格式化的JSON。其实我们的输入是通过stdin进去的，而我们会把它的stdout内容拿过来更新我们的文件。再比如HTML也同样，把我们需要的命令敲进去

```bash
tidy -qi -w 106 --drop-empty-elements 0 --drop-empty-paras 0 --tidy-mark 0
```

就会得到格式化好的文件了。其他外部工具只要支持pipe输入输出的应该都没有问题。

## 仍然存在问题的地方

Win下不能在打开其他文件的情况下打开一个有中文路径的文件。打开的话就会导致Textadept崩溃。目前原因尚不清楚。

## 总结

总之，你要是用Textadept，你就不能期待一切帮你配好了。但是通过Textadept详细的API，实现很多功能都不那么困难了。[∎](../ "返回首页")
