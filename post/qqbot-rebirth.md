# 让Q群机器人于Mirai框架中重生

在前面另一篇博客《[一些杂事](./chores.html#qq群机器人框架迁移)》中我就提到了迁移QQ机器人代码，这次又写这个的原因是，那次的迁移方式与这次很不一样。在那篇博客里面就已经提到，酷Q面临停止服务，以前大量基于酷Q的机器人要么直接停止维护，要么换框架。作为四个维基百科大群的公用群机器人，我们自然是不可能停止维护的，那只能考虑迁移。

在软件工程领域，迁移（也就是“移植”）是说将某个可执行的程序，迁移到另一个环境，让它重新运作。[^porting] 酷Q是E语言写的，而Mirai是Kotlin（一种JVM语言）编写的。虽然底层不一样，但本质都是QQ协议，没有什么重大的不同。因为我们不对接底层，只对接上层。只要上层一样，那么底层是什么完全不重要。

在之前那篇博客中，我们使用的库叫做lua-mirai。那个库很有朝气，不错，我很看好那个库。但因为luaj的一些限制，还是不如原本的lua好用。如果整个bot都迁移过去的话，也少不了重构一些代码。这次呢，我使用的是另一套方案，[mirai-native](https://github.com/iTXTech/mirai-native)，这个库的目的就是从根上兼容酷Q的API。Mirai Native需要酷Q插件的DLL和JSON文件，我使用的CoolQ Socket API的维护者mrhso在前面为我们探了路，并且提供了这两个文件，这也是我今天只花了几个小时就迁移成功的重要原因。

下面我就具体向大家介绍把酷Q机器人迁移过来的细节。Mirai Native的和众多Mirai系软件一样，文档并不给力。如果按文档安装反而会比较迷茫。曾经有一个好用的工具可以解决这个问题，MiraiOK，但在我用的时候它已经凉凉了，无法下载JDK。不过下载JDK这件事并不难，不需要自动也没什么关系。话休絮烦，继续。

Mirai Native只支持**Windows上的32位JDK**（JRE），划重点，Mirai Native是作为Mirai Console的一个插件存在的。所以想要运行Mirai Native，你需要以下这么几个库

- mirai-core-qqandroid
- mirai-console
- mirai-console-pure

这三个库中，core可以直接用最新的（我用的1.2.3版本），console和console-pure应该要用与Mirai Native匹配的版本，不然有可能不兼容（我用的1.0-M4-dev-3版本）。这三个jar包可以从bintray里面下载，也可以从[shadow](https://github.com/project-mirai/mirai-repo/tree/master/shadow)里面下载，希望大家不要找不到了。

上面说JRE的时候我还忘记提一点，最新的mirai-console把JDK版本提到了11+，这带来了一个问题，官方版本的JDK的32位版本只有JDK8，再高的版本都不提供32位版本。我为此多方打听，得知有个第三方的JDK可以支持，就是https://adoptopenjdk.net 。不过这个JDK在运行Mirai的时候有两个库提示Undefined，分别是jline和jansi。不过缺啥补啥，我马上去maven网站把这两个库的最新版（jline-3.16.0，jansi-1.18）都下载了下来，而且没有遇到版本不兼容的问题。

依赖都搞好了之后，我们就该尝试尝试运行了。这一点就是按[文档](https://github.com/mamoe/mirai-console/blob/master/docs/Run.md)操作了，先建一个批处理start.bat

```bat
@echo off
title Mirai Console
java -cp "./libs/*" net.mamoe.mirai.console.pure.MiraiConsolePureLoader %*
pause
```

执行这个批处理，就可以打开Mirai Console的控制台版本了。跑起来了还没完，这只是一个裸机器人，要加上我们的酷Q插件，并且跑起来我们原来的bot才大功告成。Mirai的文件结构是下面这样子的，

```
├─config
│  ├─Console
│  └─ConsoleBuiltIns
├─data
│  ├─image
│  ├─MiraiNative
│  │  ├─data
│  │  ├─libraries
│  │  └─plugins
│  └─record
├─libs
├─logs
└─plugins
```

刚才我们提到的5个基础Java库我都放在了libs下面，而mirai-native这个jar包位于最外层的plugins目录。而我们的酷Q插件的DLL和JSON需要放在data/MiraiNative/plugins里面。如果我们的DLL还依赖其他DLL，那就放在libraries里面。

以上都弄好之后，我们就可以登录了，登录也是一个命令

```
login id password
```

登录之后会自动加载所有的插件。如果想要知道还有什么命令的话，就`help`一下就好了。Mirai本身虽然还有一些问题，但它还在快速的迭代之中，相信它会变得越来越稳定可靠。我当初使用酷Q的一个重要原因也是稳定。[∎](../ "返回首页")

[^porting]: 参考维基百科[移植](https://zh.wikipedia.org/wiki/%E7%A7%BB%E6%A4%8D_(%E8%BB%9F%E9%AB%94))条目。
