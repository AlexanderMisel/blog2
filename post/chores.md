# 一些杂事
我博客里面很少记录杂事，这些杂事也都是技术相关，所以想看技术的不必以为你读到了一篇生活杂事的记录。因为之前一直是攒了好久的东西觉得不得不记下来才动笔写博客。因为是记录杂事，我会写快一点，减少对文章结构的考虑。

## 安装MariaDB
我本周在我的电脑上安装了MariaDB。之前我也帮同事在Deepin上安装过，但没有特别上心。自己安装到自己电脑上，就比较在意一些。Deepin的软件仓库更新较慢，里面的MariaDB才到10.1版本，是几年前的版本了。我想要安装最新的，所以就要费点劲。下面我介绍一下步骤：

首先要告诉大家，我参考的是 https://mariadb.com/kb/en/installing-mariadb-deb-files/ 这个指导，也就是官方的。Deepin不算是常见的distribution，所以官方的脚本无法自动检测版本。但我还是选择用官方的脚本，一个是懒得操心，一个是想看看顺着官方的路子装出来是什么样的。

第一步，就是下载 https://downloads.mariadb.com/MariaDB/mariadb_repo_setup , 这是一个shell脚本，执行下面的命令
```bash
sudo bash ./mariadb_repo_setup --os-type=debian --os-version=stretch
```
这里指定了使用debian的stretch版本，因为Deepin就是基于这个版本发展的。如何知道系统的Debian版本呢？运行下面这个命令
```bash
cat /etc/debian_version
```
这里看到的结果是9.0。执行完脚本之后我们需要手动更新一下软件包缓存
```bash
sudo apt update
```

这个脚本的含义就是帮我们配置MariaDB最新的软件源。那么第二步，我们就要安装了。我选择直接进Synaptic。我并不是一个什么都喜欢搞命令的人。图形界面还是很直观的。

在Synaptic里面找到mariadb-server这个包，安装一下即可。安装完了其实有点懵逼，因为不会有任何提示，如何配置数据库之类的。但我有心理准备，用deb包安装就会是这样的。它会安装到默认的位置。我们来确认一下安装成功没有。官方告诉我们，想要启动数据库，有多种方式，我们就用我熟知的方式吧
```bash
systemctl start mysqld
```

然后我们试着登录一下：
```bash
mysql -uroot -p
```

等等，我发现竟然不知道密码。因为我经验里是MySQL安装完之后是会生成一个临时密码，然后写在日志里面，不过我在网上搜啊搜，并没有搜到MariaDB会在日志记录这个。我赶紧查一查，找到了[这篇教程](https://www.jianshu.com/p/16682746137b)。但是这篇教程有个问题，就是他是在root帐号操作的，但他没告诉我，所以我怎么搞都不行。
```bash
sudo mysql_secure_installation
```

这里一定要提权。不提权的话，绕不过密码检测。那样你就改不了密码了。总之这里面你就yes，yes的，然后设个密码就成了。整完这个我们至少就可以了登录了。还剩一件重要的事就是更改数据路径的问题。我知道可以通过软链接的方式改，但是我这次偏偏不喜欢这么干，我就要通过改配置实现。但改了很多遍就是不生效，我都崩溃了。为什么不生效呢。为什么呢。我改的明明就是优先级顺序里面的啊。我尝试了改各个文件，都是不行，查看
```bash
systemctl status mysqld
```
或者
```
mysql --help | grep cnf
```
怎么都找不出问题。后来我发现还是没有root的缘故。不在root下看不到systemctl的报错信息。我切换到root之后，发现了问题。MariaDB默认为保护/home目录。我恰恰需要它用/home下作为数据路径。把service里面的ProtectHome设置成false之后，我的数据路径终于改过来了。这样MariaDB就全部正常了。

## Java各种踩坑
我前面一周时间光踩坑了。尝试使用公司的SpringBoot后台模板工程，把现有业务一部分迁移出来，使用模板工程作为基础。我的后台基础是较为薄弱的，我学到的Java和Spring感觉都不是一个东西。但随着我目前参与后台开发越来越多，我想在Java后台方面踩踩坑是绕不开的。如果在原来舒适区里，一直使用Guns作为模板，写写逻辑，不能算会后台的。既然这样，我便花些时间碰壁好了。

### 第一个坑来自MyBatis-Plus

模板工程里的MyBatis-Plus是3.11版的，原来Guns自带的是2.x版的。从2.x到3.x的变化官方文档有提到，还是蛮大的。我的思路便是把代码迁移到3.x版本，我还是很相信模板工程的。迁移一开始我觉得顺风顺水，IDEA的Auto Import一开，解决了不少问题。不得不说，这个功能足够强大。但它也不是不会犯错。不提这个。迁移让我遇到阻碍的地方在于，我解决了所有报红之后，项目启动不了。为了让大家看清下面的报错，我把它格式化一下：
```java
org.springframework.beans.factory.UnsatisfiedDependencyException:
  Error creating bean with name 'userController':
    Unsatisfied dependency expressed through field 'userService';
  nested exception is
    org.springframework.beans.factory.UnsatisfiedDependencyException: 
  Error creating bean with name 'userServiceImpl':
    Unsatisfied dependency expressed through field 'baseMapper';
  nested exception is
    org.springframework.beans.factory.NoSuchBeanDefinitionException:
    No qualifying bean of type
      'com.baomidou.springboot.cususer.mapper.UserMapper'
    available: expected at least 1 bean which qualifies as autowire candidate.
  Dependency annotations
    {@org.springframework.beans.factory.annotation.Autowired(required=true)}
```

根据以上报错，我认为大意就是找不到符合条件的mapper。我反复检查了mapper的命名、大小写之类的，发现没有问题。于是我只好借助网络。我看到了若干解决方案，但发现大部分都解决不了这个问题。我还到GitHub官方仓库进行了[搜索](https://github.com/baomidou/mybatis-plus/issues?q=is%3Aissue+is%3Aclosed+UnsatisfiedDependencyException)，发现没有一个此类问题是open的，在closed里面倒是不少。我心想这么多closed里总有一个有解答吧，结果发现没有一个是有解答的，都是直接关闭的。然后都是让你看sample。我认为这是维护者很不负责的表现。当然不是责怪他们，因为开源协议的重要一项就是不对软件负责，使用者自己承担使用开源软件的后果。但这让我对MyBatis-Plus的好感度大为降低。

我仔细地对比了sample好几遍，把mapper都加上@Mapper注解，把原来没有继承IService的也继承了，看似跟sample写得一样一样的了，结果还是不行，就是找不到。我甚至把我的方法都注释掉了，就留一个空的类，也不行。过了很久很久，我终于找到一个提示，告诉我要加上@MapperScan。我一开始加在了主类，没有效果。后来我终于找到了模板工程里面原来有一个配置MyBatis的类，在那个里面找到了@MapperScan，这让我很开心，我觉得找到地方了。因为我发现它上面写的
```java
@MapperScan("com.?????.**.mapper")
```
竟然扫描的是mapper文件夹，而不是dao文件夹？！！我赶紧加上
```java
@MapperScan({ "com.?????.**.mapper", "com.?????.**.dao" })
```
加上之后，果然好像有点效果，错误变成了类似这样
```java
org.springframework.beans.factory.UnsatisfiedDependencyException:
  Error creating bean with name 'helloController': 
    Unsatisfied dependency expressed through field 'mapper';
  nested exception is org.springframework.beans.factory.UnsatisfiedDependencyException:   Error creating bean with name 'xxx' defined in file [xxx.class]:
    Unsatisfied dependency expressed through bean property 'sqlSessionFactory';
  nested exception is org.springframework.beans.factory.BeanCreationException:
  Error creating bean with name 'sqlSessionFactory' defined in class path resource [xxx.class]:
    Bean instantiation via factory method failed;
  nested exception is org.springframework.beans.BeanInstantiationException:
  Failed to instantiate [org.apache.ibatis.session.SqlSessionFactory]:
    Factory method 'sqlSessionFactory' threw exception;
  nested exception is java.lang.NoClassDefFoundError: org/mybatis/logging/LoggerFactory
```

这个报错看上去跟上面差不多，都是UnsatisfiedDependencyException，其实明显不是同一个错，关键在最后面

```
NoClassDefFoundError: org/mybatis/logging/LoggerFactory
```

我认为这个是这次报错的特征。这个就确实有人解答了，但是一开始搜到的还是解决不了。他们说有可能是PageHelper和MyBatis-Plus冲突，要在pom文件里把这两个依赖exclude了，结果还是，无效！最后还是一个CSDN救了我，多添加了一个

```
mybatis-plus-extension
```

依赖，虽然我不知道为什么，但完美解决了所有问题。这也就是第一个坑的经过。

### 第二个坑来自SpringContextHolder

这个问题与我缺乏Java知识有关。我之前同事在写代码的时候，发POST请求，并没有直接使用RestTemplate，而是在上面又封装了一层RestTemplateUtils。在这个里面用到了SpringContextHolder。而SpringContextHolder又来自guns内部。我为了移植的同事不引入guns的包，我就把class反编译的结果自己建了一个java类，结果不行。代码一样，自己建的Java类就报错。由于报错的地方恰好是没用到的方法，我就直接删掉了。但还有一个问题，让我解决了好久，改过后的SpringContextHolder提示未注入

```
applicaitonContext属性未注入, 请在applicationContext.xml中定义SpringContextHolder
```

我用了各种方法，都注入不进去，包括在TaskConfig里面，在主类，在Runnable。唯一看起来比较靠谱的是说在springmvc.xml里面加入一条bean的元素。但是我们项目没有这个文件，也没有人说SpringBoot怎么办的，应当怎么写XML，所以我决定尝试更简单的办法。

我照 https://blog.csdn.net/weixin_30610755/article/details/97105678 的方法写了一个不继承ApplicationContextAware的写法，然后在主类里面setApplicationContext。这种方法没有遇到任何问题，也没有涉及到注入applicationContext的问题，感觉更加适合我这样的。如果这样写有什么问题的话，请告诉我一下哦。目前我看着运行正常。

### 第三个坑来自打包工具的使用

大家应该知道Java有很多中打包工具，我们公司用的Maven。我最近遇到一个用Eclipse开发的项目，运行和打包方面给我带来了疑惑。项目地址是https://github.com/luaj/luaj 。

这个项目的最大问题是我不知道如何运行，如何打包。在README里我没有捕获到有用的打包信息。如果README把打包这一节写稍微详细一点就好了。这个项目没有pom文件，这让我有点像无头苍蝇。因为我只build过有pom文件的。但这个项目其实写的build文件其实是针对Ant的。

> **Apache Ant**，是一个将[软件](https://zh.wikipedia.org/wiki/软件)[编译](https://zh.wikipedia.org/wiki/编译)、[测试](https://zh.wikipedia.org/wiki/单元测试)、[部署](https://zh.wikipedia.org/wiki/软件部署)等步骤联系在一起加以自动化的一个[工具](https://zh.wikipedia.org/wiki/软件开发工具)，大多用于[Java](https://zh.wikipedia.org/wiki/Java)环境中的[软件开发](https://zh.wikipedia.org/wiki/软件开发)。由[Apache软件基金会](https://zh.wikipedia.org/wiki/Apache软件基金会)所提供。

这个项目使用Ant的原因我感觉可能是因为时间更久远。它的依赖并非从maven仓库获得，而是直接从luaj网站上下载压缩包解压到lib文件夹，当然Ant完全可以胜任这种事。Ant的build文件里面有一个mvn_install命令，用这个我成功生成了jar包。

在运行这个的时候我遇到一个小插曲，mvn找不到。这个是因为在Windows的缘故，需要把Ant的build文件里面的mvn改为mvn.cmd才能正常执行。

## QQ群机器人框架迁移

今年八月腾讯开始严打，第三方QQ机器人框架纷纷下线，这其中就有我之前用的，也是最广泛使用的酷Q框架。有人说，做QQ机器人框架就是得开源才活得下去，就是不能和金钱有关。的确，目前我国法律主要追查的也是靠这些手段获利的，对于那些不获利的，比较不容易受到追查。不说太多。

我现在尝试使用的是QQ机器人框架新秀mirai的lua协议库。这个lua-mirai也是kotlin语言编写的，使用了luaj作为其提供lua扩展的方式，我为了改一个问题，才涉及到编译luaj这个库，具体见上。

跟作者交流过程中，我了解到他用Lua的一个原因就是热加载。腾讯现在封号比较严重，如果改代码频繁需要重登录的话，一个是容易被腾讯查，另一个也是麻烦。其实最近我了解到，真正的热加载可以考虑使用文件系统事件，监听文件改动的。但由于这个Lua是Luaj，那些C语言lua的库是用不上的，所以我就写的人工发信号重新加载，代码大概是下面这样的

```lua
--获得bot对象
bot = Bot(10000, 'password', 'deviceinfo.json')

--登录bot
bot:login()

function load_script()
  local f, err = loadfile('bot.lua', 't')
  if not f then
    print(err)
    return
  end
  _, err = pcall(f)
  print(err)
end

-- hot reload
bot:subscribeFriendMsg(
  function(bot, msg, sender)
  	if sender.id == 10000 and msg then
      if msg == 'reload' then
        load_script()
      end
    end
  end
)

load_script()
```

Lua的`loadfile`很方便，比较底层，加载解析lua文件。而且跟`require`不一样，`loadfile`之后不会立即执行，只是把代码当作一个chunk读到一个函数里面，如果这一步就有错了，那就不需要后面的执行了。这个脚本的作用就是，只要我给它发reload信号，它就会重新加载一遍脚本。

虽然我以前用的框架是基于Socket通信的框架，但其实最直接的还是这种事件订阅。机器人脚本这一侧不需要考虑隔一段事件确认一下心跳的问题，由框架完成。[∎](../ "返回首页")