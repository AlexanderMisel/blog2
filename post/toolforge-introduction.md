# toolforge入门攻略

我很早之前就从维基前辈那里听说过Toolforge了。大家都知道维基百科有很多机器人，还有很多小工具。可以说在当今的维基百科的正常运转，是非常依赖于这些自动化程序的。作为普通的编者，可能接触更多的是半自动编辑工具，比如Twinkle、Wikiplus、Cat-a-lot之类，这些一般只要前端JS脚本就可以实现了。但全自动运作的机器人，则一般是持续跑在某台电脑的程序，我们可以在编辑历史里面看到它们的踪迹，但除了已经涉足维基的技术领域的用户以及机器人的主人以外，可能对机器人实际运作的方式以及运行环境的可能并不十分清楚。另外，那些并非能简单通过前端实现的小工具，其实需要有一个环境来运行。本文就向大家介绍一下众多这类工具运行的一个环境，Toolforge。

目前我看到的有关Toolforge的介绍都是英文的。当然大家都受到了良好的英文教育，看懂应该是不成问题。不过阅读外文的资料毕竟不如母语资料顺畅，我一直没有尝试涉足Toolforge。但终于，最近，我想要一探深浅了。那么我就陪大家一同来认识一下Toolforge吧！

>Toolforge是一个托管环境。Toolforge使您可以轻松地执行分析、管理机器人、运行web服务和创建工具。这些工具可以帮助项目编辑、技术贡献者和其他志愿者在维基媒体项目上工作。
>
>Toolforge是Wikimedia Cloud Services（WMCS）服务套件的一部分。它得到了维基媒体基金会的工作人员和志愿者的支持。
>
>此页面包含工具开发人员、维护人员和Toolforge管理员的文档链接。

简单来说吧，就是这么多机器人，不能让大家掏腰包去租服务器啊。而且有些机器人和小工具本身就是基金会开发的，运行在WMCS上，开放给大家用其实也是对维基媒体运动（Wikimedia Movement）本身的一种支持。与Toolforge相关的可以WMCS提供的另一种解决方案Cloud VPS。用说明文档里的解释来说，Cloud VPS是一种IaaS解决方案，而Toolforge是一种PaaS解决方案。相信熟悉云计算的大家对以上的词汇不陌生。具体来说，Cloud VPS就是提供一台虚拟机给你耍，你需要自己决定安装什么软件，自由度较高，不过Cloud VPS也比Toolforge要难申请一些。Toolforge的话，你同样可以通过SSH访问命令行，但你的权限有限，相当于服务器系统、数据库以及相关配套设施都安装好的一个环境，你可以运行你的程序，做这个环境下你能做的事。

我们来看看Toolforge的结构：堡垒机（bastion host）、作业网格（job grid）、web集群（web cluster）、数据库（database）。[^en] 那么什么是堡垒机呢？来看看维基百科怎么说：

> **堡垒主机**是网络上专门设计和配置以抵御攻击的一种特殊用途的计算机。这类计算机通常托管着单个应用程序，例如代理服务器，所有其他服务都被删除或限制以减少对计算机的威胁。

另外有一个与堡垒机类似的概念，叫做**跳板机**（jump server），它与堡垒机的主要区别是，跳板机是连接两个可信网络的桥梁，堡垒机则不然。

“作业网格”是网格计算的一个概念。Grid Engine目前是Toolforge的两大后端之一，另一个是Kubernetes。从文档里我们也看到基金会在积极推动大家把能在Kubernetes运行的程序，都用Kubernetes跑。但毕竟K8s的技术比较新，很多机器人程序都还是采用Grid Engine的方式启动，但其实他们那些程序迁移过去其实不难。我采用的也是Grid Engine，因为它有generic的选项，toolforge的K8s的只支持几种常见的语言（golang、jdk、node、php、python、ruby、tcl），而我要用OpenResty+Lua。

关于web集群，其实实际的操作是一个黑箱，但我们知道它有一个前置的代理，代理会把请求分发给集群中的服务器。而且无论哪个服务器都可以跑任何一个Toolforge定义的web服务，这是因为Toolforge使用了**共享存储**（shared storage）。就相当于同一个存储大家都能访问。其实这个概念已经是和Kubernetes容器云那一套异曲同工了。

最后就是数据库。跟维基媒体的数据库一样，是MariaDB。我们在toolforge里面可以连上一个公用的wiki replicas，方便我们分析维基数据；以及一个用户创建的数据库，方便我们的Web服务存储数据。当然，在数据库之外，还有Redis和ElasticSearch可以使用，可以说在基础设施上还是非常齐全的。这也就让我们不用去请求管理员安装软件，也能搞自己的工具或者机器人了。

## toolforge实际操作篇

Toolforge即便再好，如果不能用也是白搭。想要让基金会的资源给我们用，申请的流程是少不了的。但申请的流程又是用英文描述的，头大。我也是懒得看，但这次硬着头皮看了。下面我就说下我的流程，主要参考官方的[Quickstart](https://wikitech.wikimedia.org/wiki/Portal:Toolforge/Quickstart)

1. 创建一个维基媒体开发者帐号。（[这个链接](https://toolsadmin.wikimedia.org/register/)直接搞定，创建过程无审核。）

2. 创建完就可以了登录[toolforge admin](https://toolsadmin.wikimedia.org/)这个页面了。（注意到这一步并不意味着你可以SSH开干了，你会发现虽然你有SSH帐号，但是还不能用）

3. 需要先申请入伙，也就是[Membership](https://toolsadmin.wikimedia.org/tools/membership/apply)，然后就等着吧，等上几天就通过了。

4. 通过之后你才可以连SSH。注意连的话要先配置SSH的公钥（public key），这就会代替密码，让你直接连上服务器。

   ```bash
   ssh yourname@dev.toolforge.org
   ```

   但你如果想要用SOCKS5代理连SSH呢（毕竟大陆连接很慢），就用下面这个

   ```bash
   ssh -o ProxyCommand='nc -x 127.0.0.1:1080 %h %p' yourname@dev.toolforge.org
   ```

假设你成功连上了，你就可以一通操作了。先练练Linux基本操作，摸索一下文件结构吧。我并不建议上来就开始建tool，开webservice。熟悉一下环境还是很必要的。如果你之前没有接触过Linux，就更可以熟悉一下啦。比如别人的项目在哪，共享的资源在哪，维基百科dump以及pageview数据又存在哪。种种，放心，你没有删库的权力，你只有删除自己的文件的权力。这里你不会有root权限，你也就能够学乖如何在低权限下做成事情。

感觉熟悉得差不多了，就创建tool吧。也许你在想，为什么不直接开始搞事情，而建tool呢？我想了两个原因：一个是tool可以方便协作，可以有多个贡献者；另一个是，你可以让你的toolforge不至于太混乱。有了tool，你可以直接在tool的home里面放代码，执行或者提交Job。

## 编译与运行OpenResty

虽然我也能用Java、Python或者Node.js，但终究想用自己喜欢的Lua来编写tool。还好Grid Engine支持通用类型的服务。我想既然这样，我就安装OpenResty呗。然而我发现，dpkg是用不成的，那么正好，直接源码编译安装。OpenResty的编译需要这些库：

```
libpcre3-dev libssl-dev perl make build-essential curl
```

然而toolforge上一个不缺。于是可以编译安装了。使用下面的命令

```bash
./configure --prefix=/data/project/tool-name/openresty
```

把tool-name改为你tool的名字。因为默认的`/usr/local/openresty`是装不进去的。不过我考虑如果你多个tool都要用OpenResty呢，不可能编译多遍，可以考虑放到`/data/scratch`里面，但我没有试过，不知道会不会遇到权限的问题。

不久之后configure就完成了。在configure过程中其实也编译了一些基础的库，比如LuaJIT。完成之后呢，就该make了。根据CPU的核数，我们直接采用

```bash
make -j8
```

据说可以发挥多核的优势来加速编译。Toolforge的性能并不高，所以该加速还是要加速一下的。不过make的过程还是比较长。之后再

```bash
make install
```

就大功告成了。把官方[新手上路](https://openresty.org/cn/getting-started.html)的例子下载下来，可以成功运行。不过我遇到的下一个问题是作为webservice运行。

使用OpenResty的目的是搞网站，如果外部访问不了，那再好也是没用的。好的，这里有一个坑等着我们，那就是：对于Grid Engine来说，每次映射给外部的端口号都是不一样的，这个端口会作为PORT这个环境变量提供给我们。但对于Kubernetes来说，永远都映射8000端口。这就需要我们的Nginx每次都监听一个不同的端口。这难不倒我们，写一个nginx配置的模板，里面PORT用变量表示，然后用shell脚本替换一下再跑我们的服务就好。下面是我写的脚本，叫做start_server.sh

```bash
#!/bin/bash
PATH=/data/project/tool-name/openresty/nginx/sbin:$PATH
export PATH
cd /data/project/tool-name
envsubst '${PORT}' < conf/nginx.template > conf/nginx.conf
nginx -p `pwd`/ -c conf/nginx.conf
```

然后我就尝试跑webservice了，

```bash
webservice --backend=gridengine generic start /data/project/tool-name/start_server.sh
```

但是有点让我失望，服务并没有启动成功。我检查error.log发现没有东西，检查service.log依然没有有用信息，全都是

```
2020-10-21T14:59:46.729025 Throttled for 3 restarts in last 3600 seconds
```

这种信息。我就疑惑，问题在哪儿呢？我尝试了直接jsub这个脚本，直接运行这个脚本，都没发现问题。于是我就跑到IRC上面问问题了，[#wikimedia-cloud](irc://irc.freenode.net/wikimedia-cloud)，不懂就问，不过他们也没有给我特别有用的提示，但他们说理论上是可以这样运行的。那咱就再想想问题在哪儿吧。我甚至找到了webservice这个工具的[源码](https://github.com/wikimedia/operations-software-tools-webservice)，因为我怕是它没有把PORT传过来，结果发现它还是很忠实的。但我突然想到，会不会是nginx是在后台执行，所以让python以为我的程序已经结束，就结束掉了webservice呢？按照这样的猜测，我找到了如何让nginx不在后台默默运行，那就是在nginx的配置文件里面加入

```
deamon off;
```

尝试过后果然迎刃而解，居然是这么简单的问题。其实玩toolforge还涉及到如何访问MariaDB数据库，如何用ElasticSearch搜索条目内容，如何用Redis之类的，不过由于太简单，看看文档就明白了，我就不费篇幅了。我日后会继续利用Toolforge来实现我的想法，等那时候在继续分享。[∎](../ "返回首页")

[^en]: 我这里每个词都写英文并不是怕大家看不懂，只是想要方便大家与英文文档中的名词对应起来。