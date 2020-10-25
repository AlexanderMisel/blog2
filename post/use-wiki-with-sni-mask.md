# 如何在Linux下使用中文维基

这是迄今为止最好用的一种方法。只要你的系统是Linux（我估计Mac也行），你就可以轻松使用中文维基、日语维基等等维基百科。你不需要拥有一个国外服务器，你只需要在你的机器上运行一小段python代码即可。这段代码来自https://github.com/Macronut/SNI-Mask。这个项目里面有个sni_mask.py的文件，保存到本地。

然后先在本地改掉hosts文件。如何改呢？相信大家很熟悉了。首先打开控制台，输入

```bash
sudo gedit /etc/hosts
```

打开之后，就可以了加上下面几行

```
127.0.0.1 zh.wikipedia.org
127.0.0.1 en.wikipedia.org
127.0.0.1 ja.wikipedia.org
127.0.0.1 login.wikipedia.org
```

然后<kbd>Ctrl</kbd>+<kbd>S</kbd>保存。然后再在控制台打开你保存sni_mask.py的文件夹（我是保存在~目录下），输入下面的命令

```bash
sudo python sni_mask.py
```

敲回车，就能在控制台看见类似下面的文字

```bash
2018-09-08 20:22:06 INFO     starting local at 0.0.0.0:443
```

完成，然后打开你喜欢的浏览器，输入维基百科的网址，你就可以访问啦～注意不要直接关掉控制台喔。如果你嫌这个控制台碍眼，可以移动到Linux的另一个工作区里。

---

有同学反映他们想用ssh连接远程服务器运行这段代码，但是ssh关掉就不行了。那么我也补充一下可以远程持续运行这个服务的方案吧。就是把上面的`sudo python sni_mask.py`改成下面的

```bash
sudo sh -c 'nohup python sni_mask.py &'
```

或者参考https://askubuntu.com/questions/8653/how-to-keep-processes-running-after-ending-ssh-session上使用`screen`命令的方法，我就不详细介绍了。[∎](../ "返回首页")