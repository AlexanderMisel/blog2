# 探索Word格式

近期，我向公司内部提供了一个我写的前端HTML导出为Word的库。这个库从我2019年参与的某项目中相关功能的代码中抽离出来，用于将浏览器看到的简单HTML转换为docx文件。这本身是有通用意义的。

以往我在公司参与过的B/S架构的项目，很多都涉及到了Word导出的问题。以往的Word导出往往我们选择的是后端Word模板的形式，前端把某些会变动的部分传给后台，后台再拼进模板里，然后调用相关的库生成Word。虽然能够解决问题，但灵活性差些。每多一个模板，就需要后端多存一个。模板一改，前端显示和后端模板都需要修改，多干一遍活。

另外就是我认为使用前端导出Word方便的地方，当然不一定真的是比后端方便，因为我没有真正对比过。我想说的就是，前端有方便的DOM树结构。其他语言虽然也有HTML和XML处理的库，但是JS操作DOM树结构实在太方便了。在我提供的对外函数参数里面，索性就没有用HTML，而是直接用DOM Element作为参数，直接用函数遍历HTML DOM树，构建XML DOM树，然后转string，基本思路就是这样。

如果你们也想入手Word格式的话，我有个网站要推荐给你们：http://officeopenxml.com/。这是我编写这个库期间用得最多的一个网站。虽然OOXML有标准的定义，ECMA-376嘛，但是标准这种东西往往写得就晦涩。在OOXML里面，Word相关的叫做WordProcessingML。下面我将介绍从HTML到Word所需要的主要转变。

**第一点，HTML是一种非常灵活的树结构**，它不同于WordProcessingML，一种一点都不灵活的结构。如果想要简化从HTML转换为WordProcessingML的话，就免不了要限制一下HTML本身的结构，但我觉得这样限制是有价值的。为了更高程度地保有原来HTML的格式，这点非常有必要。以下是我遍历DOM树的一个函数：

```js
var traverseNodes = function (inNode, outNode) {
  for (var inNodeChild of inNode.childNodes) {
    if (inNodeChild.nodeName === '#text') {
      var content = inNodeChild.nodeValue.replace(/\s+/g, ' ')
      if (content !== ' ') {
        outNode.appendChild(newXMLnode('p')).appendChild(newXMLnode('r'))
          .appendChild(newXMLnode('t', inNodeChild.nodeValue));
      }
    } else {
      var inNodeName = inNodeChild.nodeName;
      var hTag = inNodeName && inNodeName.match(/^H(\d)$/);
      if (inNodeName === 'P' || hTag) {
        var pNode = output.appendChild(newXMLnode('p'));
        ...
        traversePnode(inNodeChild, pNode);
      } else {
        traverseNodes(inNodeChild, outNode);
      }
    }
  }
}
```

大概意思就是，`traverseNodes`这个函数可以处理多层嵌套的div，因为我知道大家常常需要多层套娃来处理各种定位，如果在这里就开始限制层数，我觉得会限制大家在网页布局的发挥。当我发现node名称是h或者p的时候，就会使用`traversePnode`来处理内部元素，内部就不能有太多层的嵌套了。

而在Word里面，正文部分会只有**p节点** （paragraph）和**r节点** （range）两级，p的样式使用pPr定义，r的样式使用rPr来定义。你在pPr想要定义rPr里的字体、字号之类的是没用的，文档里也说可以在pPr里写rPr，但是我并没有看到效果，反而无论Word还是WPS都是把rPr放在了具体的r节点里面。

其实Word这种扁平的格式对于Office的程序员来说是友好的。实现一个类似浏览器那样的layout引擎对于一个文本处理软件来说并没有太大必要。好了，不扯这些。

**第二点，Word使用的计量单位多样**，这对于我们来说很烦。与大家在Word可视化操作界面见到的统一单位不同。关于这个，大家在看文档的时候自会有体会。这篇[知乎文章](https://zhuanlan.zhihu.com/p/78307080)就提到了pt、in、dxa以及emu之类的单位。而我们在网页中常使用的单位是px、em。我们那些单位其实被称作是**虚拟单位**（virtual unit），而Word用到的这些单位称作**物理单位**（physical unit），虽然是英制的。虚拟单位和物理单位直接是不能直接转换的，跟有一个参数有关，就是DPI。说得好理解一点，px也就是像素，它的实际大小是不固定的。在HDPI屏幕上面，同样的物理长度，就拿1cm来说吧，就会有更多的像素。

由于在这方面不同，我的时间又有限，我就索性在某些方面只支持pt作为单位了。pt也算一个常用的单位，在定义字号方面很常用。

**第三点，特殊的布局需要进行转换**。有些格式是HTML和docx不好互通的。比如Word中的制表位，在HTML里是没这样的概念的，但是同样的效果并非无法实现，CSS是非常强大的布局技术。对于这些特殊的布局，我想到的方法就是让它们绑定固定的class。在转换成Word的过程中，我会获取这些class，将格式特殊处理，成为对应的Word格式。双行合并这种CJK排版才有的特殊格式，我也采用了类似的操作。另外还有，水平线要用border-bottom实现，才方便导出的时候处理，因为Word中的pBr是直接跟那个对应的。

**第四点，出错的解决办法**。文档也许很清晰，但毕竟很长，检索不像普通的文档那么方便。还有，Word的某些格式，如表格、图片，这些的XML格式比HTML要复杂，参数众多，有些参数不好理解。那留给我们的办法就是试了。我们手上除了握有文档，还有Reference Implementation啊，也就是Word啊、WPS的啊。理解不了，试就对了。

在DOCX里添加相应的格式，如图片，然后保存。保存完之后，用随便一个解压缩软件，解压缩。如果右键没有解压缩，你就把文件名最后面的.docx改成.zip然后解压缩，就会看到docx格式的真容。然后你就可以看看微软、金山是如何实现WordProcessingML的标准的了。根据我的经验，有的地方Word比较宽容，有的地方WPS比较宽容，但WPS宽容的地方多一些。即便你用WPS打开非常正常的内容，在Word也有可能出不来，这很有可能就是你遇到微软要求严的地方了。

还是举Word中图片的例子，需要更改的地方涉及到了三个地方，如果通过这种手段就需要找出这三处地方。少一处修改，Word就无法识别，我也被卡一天的时间。就连最容易的document<wbr>.xml也因为不知道哪个字段必填而纠结半天。另外两个地方一个是document<wbr>.xml<wbr>.rels，一个是[Content_Types]<wbr>.xml。rels存储relationship，就是文件之间的关系，而Content Types存储涉及到的所有文件类型。

有两个迷惑的地方，一个是图片的id编号，另一个是图片的命名。图片的ID是与上面的rels相呼应的，rels的编号在Word里面全都用rId1、rId2这种格式命名，但其实，根据我测试的结果，只要是唯一ID就行，不必拘泥这个命名；同样，图片的命名，Word都把它们重命名为了image1.png，image2.jpg这种名字，我还以为有什么讲究呢，但试验的结果也是，完全不用拘泥。

这篇文章就总结到这里吧，细节方面不会写太多，但坑是点到了。[∎](../ "返回首页")