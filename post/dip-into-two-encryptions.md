# 初识两种加密算法

本周我接到的工作里要对接的平台有涉及到两种加密算法，**3DES**和**AES**算法。这两种加密算法应该说是我小学的时候就听过了，因为是相当古老的。我小学的时候接触到哥哥上学的课本，而那本书里恰好就有加密算法的部分。然后也对DES和AES这两个名字印象很深刻。

但由于我专业并不是计算机或者信安，一直到大学毕业，都没有具体学到这方面的知识。在大学的时候，我曾经自己尝试实现了RSA算法，但我实现的并非符合哪个IETF标准的。但对于个人学习是足够的，因为RSA的主要难点在寻找两个超级大的质数，所以其他部分是怎样的其实不重要。由于不是本文的主题，感兴趣的同学可以了解一下[素性测试](https://zh.wikipedia.org/wiki/%E7%B4%A0%E6%80%A7%E6%B5%8B%E8%AF%95)（Primality test），通过这个可以快速地判断一个数大概率是一个质数，而不必去真正把它分解质因数或者去搞Eratosthenes筛。

好啦，说回到主题。3DES和AES都是什么呢？首先简单介绍一下。3DES和AES都属于**对称加密算法**。而我前面提到的RSA以及现在比较流行的ECDH都属于**非对称加密算法**。对称加密和非对称加密的主要区别在于加密方和解密方的地位是否是对等的。（上面这句是个人总结）浅显的理解就是，对称加密中加密和解密用到的密码是一套，而非对称则加密用公钥，解密用私钥。下面我就具体介绍一下我探索3DES和AES的过程吧。

## 3DES

3DES的正式名称是Triple DES，另有一个简称叫DESede。3DES的密钥分为三个，k1、k2、k3。这三个都是8个字节长度。

- 加密：输入->k1 DES加密->k2 DES解密->k3 DES加密->输出
- 解密：输入->k3 DES解密->k2 DES加密->k3 DES解密->输出

虽然内部是这样，但外部我们看到的其实只要有一个密钥，有一个明文就够了。把一个24字节的密钥切成三个的操作，其实是程序内部进行的。在Java或者OpenSSL里，这都是封装在内部的。在Lua中，有一个较为朴素的实现，就是[lua-lockbox](https://github.com/somesocks/lua-lockbox)。根据其README文件，这个库编写的目标不是运行效率，而是易读易用性。下面是lockbox进行3DES加密解密的方法。

```lua
local Lockbox = require("lockbox");

Lockbox.ALLOW_INSECURE = true;

local Array = require("lockbox.util.array")
local Stream = require("lockbox.util.stream");

local PKCS7Padding = require("lockbox.padding.pkcs7")
local DES3Cipher = require("lockbox.cipher.des3")
local Base64 = require("lockbox.util.base64");

local CBCMode = require("lockbox.cipher.mode.cbc")

local cipher = CBCMode.Cipher()
                    .setKey(Array.fromString("abcd1234"))
                    .setBlockCipher(DES3Cipher)
                    .setPadding(PKCS7Padding)

local res = cipher.init().update(Stream.fromString('12345678'))
                .update(Stream.fromString('If you want to keep a secret, you must also hide it from yourself.'))
                .finish().asBytes()
print(Base64.fromArray(res))

local decipher = CBCMode.Decipher()
                    .setKey(Array.fromString("abcd1234"))
                    .setBlockCipher(DES3Cipher)
                    .setPadding(PKCS7Padding)

local plain = decipher.init().update(Stream.fromString('12345678'))
                .update(Stream.fromArray(res))
                .finish().asBytes()

print(Array.toString(plain))
```

写lua-lockbox这个人的代码风格有些像写Java出来的。这个库还是非常有学习价值的，只不过文档太过简陋，有些地方实现也有些简陋。这次我实际对接的是3DES-CBC加密，采用PKCS5来填充。在得知PKCS7与PKCS5是兼容的情况下[^pkcs5]，我才考虑使用这个库。

根据[这篇博客](https://www.jianshu.com/p/c49b9768a6e9)我得知lua-lockbox实现的PKCS7补位（即填充）算法并不标准，也不能说不标准吧，就是和OpenSSL的实现有出入，这就会导致Lua和Java的加密解密不能互通，但不互通就没有意义了。但还好这篇博客给出了解决办法，我亲自验证，确认博客中的修改是正确的。博客中还提到，补位正确之后，又会遇到“lua-lockbox没有去掉补位数据”的问题，我也遇到了，没想到与博客时隔两年，一样的问题还在这个开源项目里。

不过，不影响它的学习价值。关于3DES的核心我就是从他的实现[des3.lua](https://github.com/somesocks/lua-lockbox/blob/master/lockbox/cipher/des3.lua)里面学到的，如何处理密码块，加密输入块。这里一定要注意，是**输入块**，而不是**明文**。我在这里踩了一个小坑。我后面在实现自己的3DES的时候打算用3个DES这样实现，但搞完才发现自己是错的，后面在CBC模式下每一组明文都会先和上一组密文先进行异或然后在变为输入。大家也可以拍脑袋想想这会带来什么。没错，这会让同样的明文出现在后面和出现在前面加密出来的结果是不一样的，即便用相同的密钥。此外IV向量的出现也让第一块明文的加密结果随机化。

![CBC_encryption](../img/CBC_encryption.svg)

前面的基础也许在后面我的实现里用处并不大，但对于了解加密解密的行为是必要的。我一开始也没想着自己去搞一个3DES实现出来，但就像[这个issue](https://github.com/openresty/lua-resty-string/issues/11)说得，看来章亦春（agentzh）大佬并不打算去帮我们搞定ngx_lua版本的DES（以及3DES）加密，但他用FFI实现的AES系列加密，我觉得很好理解，所以我就开始了对它的改写。

由于Nginx依托的OpenSSL几乎就是业界标准，而我看着Java似乎也是向它靠拢的。OpenSSL默认使用了标准的PKCS7填充，所以我并没有增加设置padding的选项。在OpenSSL的FFI基础上，我很容易地实现了DES。在3DES方面遇到了点小困难，一个是前面提到的思路的问题（这个最终通过绑定`EVP_des_ede3_*`系列底层函数解决[^ede3]），另一个就是IV向量长度应该为8，而不是24的问题。搞定这些小问题之后，这套代码就可以成功地对方公司用desede/CBC/PKCS5Padding配置在Java下生成的密文进行解密了。通用的DES和3DES的代码，我发布到了[GitHub](https://github.com/AlexanderMisel/lua-resty-des)上。

## AES

我曾经以为自己对AES有些认识，但接触到实际的AES之后，我发现了解还是不够啊。在AES领域，同样涉及到上面提到的分块加密模式（CBC/ECB/CFB），也同样涉及到padding（填充）和iv（初始化向量）。除此之外，AES还涉及到数据块长度的区别，有AES-128、AES-196,、AES-256等。

在看到对方公司的对接文档以后，我一脸懵逼，居然只说了要用AES-128，然后还有密码；采用哪种模式，哪种padding，iv是多少，一概没说。还好对方公司研发很好说话，直接就把他们加密解密的Java给了我，我一看才知道，原来Java搞了一个默认配置的骚操作。根据[这篇博客](https://studygolang.com/articles/19223)的描述，在**Java中不带模式和填充来获取AES算法的时候，其默认使用AES/ECB/PKCS5Padding**！有了这个信息，我感觉还行，没超纲，而且在lua-resty-string中aes.lua的范围内。

于是我开始尝试进行解密，但却遇到了问题。解密的结果并不是我想要的明文，而是乱码。仔细检查我看着密码也对，加密方式也对，到底哪里出现了问题。在阅读Java代码的时候我发现，他们的密钥是这么生成的。

```java
Security.addProvider(new sun.security.provider.Sun());
SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG",
                                new sun.security.provider.Sun());
KeyGenerator kgen = KeyGenerator.getInstance("AES");

secureRandom.setSeed(password.getBytes());
kgen.init(128, secureRandom);
```

也就是说其实他们用作密钥的并不是原始的key，是经过KeyGenerator生成的key。能够理解用默认配置的AES的强度并不是特别大，处理一下密钥也属合理。但为什么使用的是随机数呢？随机数不会让加密解密使用的密钥不一样吗？经过简单的试验，我发现其实这个疑虑是多余的。它产生的这个随机数是一定的。我们大家应该都听过**伪随机数**的概念，它接受一个种子（seed），根据种子去产生后面一个个的随机数。而在这里，我们原始的密钥正是充当了种子的角色，有它产生的第一个随机数就会作为真正的密钥使用，这个随机数当然是唯一的。

然而SHA1PRNG这个随机数是Java特有的，我一度以为我还要手动实现一下这个随机数生成算法。但通过在网上查询，我发现这个随机数的实现方式其实就是把原始的种子提取两遍SHA1摘要，然后把结果提取前16个字节。在我研究DES的时候还专门看了一下hash函数这块儿，而这在OpenSSL里就是一个可以选用的参数而已。于是我用下面的配置生成了AES加密对象：

```lua
aes:new("password", nil, aes.cipher(128,"ecb"), aes.hash.sha1, 2)
```

没想到如此真的和Java的迷惑SHA1PRNG搞出来的加密结果一模一样。

---

经过以上的探索，我觉得我的密码学知识又上升了一小截。从对密码学有点敬而远之的态度，有了一点点转变。希望我初识3DES和AES这两种加密算法的经历能够帮到大家吧。我依旧是反对上来就贴一篇Java代码那种博客，现在那种博客真是太多了，从那种博客真的很难学到东西。那感谢大家阅读到这里了。后面这个方块是“返回首页”的链接喔。[∎](../ "返回首页")

[^pkcs5]: PKCS7与PKCS5在算法上是一样的，只是PKCS5严格规定block大小为8位。
[^ede3]: OpenSSL在这块儿实现了多组底层函数，值得注意的是`EVP_des_ede_`开头的其实是“Two key triple DES”，也就是k1,k2,k1模式的3DES，并非我们最一般的k1,k2,k3模式的，所以应该用`EVP_des_ede3_*`系列函数。