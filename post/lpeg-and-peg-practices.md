# LPeg与PEG文法实践

看过我之前的博客的人应该知道，我已经成为一个Luar了。Lua现在是我第二常用语言，我业余生活的第一常用语言。我工作中最常用的语言是JavaScript，因为我是一个前端嘛。在提LPeg之前我首先还是要提一下当今在所有语言中几乎都必备的一个部分，那就是模式匹配。

因为我不是一个计算机专业的毕业生，我在大学并没有在课堂上学到过有关模式匹配的知识。我们首先看看模式匹配是什么：[^technopedia]

> 计算机科学中的**模式匹配**是检查和定位原始数据或标记序列中某种模式的特定数据序列。
> 
> -- techopedia

我也看了维基百科和百度百科的定义，但说得不是很明白，所以我才找的其他来源上的定义。在现代编程中，模式匹配最常用的方式应该就是**正则表达式**了（在课本上也会称作**正规式**），这个大家应该都听过。我在工作过程中，应该已经是频繁使用正则表达式了。在JS中，在字符串中查找替换基本上就会用到正则表达式。

Lua的字符串库中也支持了类似正则表达式的语法。不过Lua自带的模式匹配比我们常用的正则表达式要精简很多，也会有很多难以表达的模式。当然我不是说Lua自带的不好。从极简主义的角度看，这一点是极好的，毕竟其实Lua自带的模式可以满足大部分需要。而且据说，只要是Lua自带的模式匹配能匹配的，效率比PCRE（一种正则表达式标准）还要快。所以我也在程序中能用自带的就用自带的。

不过我一直知道，Lua有一个强大的匹配库，也是Lua的作者Roberto Ierusalimschy推出的，叫做**LPeg**，它不但可以弥补Lua原生匹配的不足，甚至比正则表达式的表达能力要更强。但说实话，它的文档写得并不好。例子少，函数怎么使用介绍得也不清楚。所以我一开始能避开就选择避开了。但是，大家也知道，我几个月前开始使用一款编辑器，叫做Textadept。这个编辑器的所有语法高亮都是采用LPeg编写的。而且可以用非常少量代码来编写一种语言的lexer（词法分析器）。这就让人很感兴趣。

拿我写的一小段解析Markdown语法的代码为例，给大家看看LPeg是如何发挥作用的。

```lua
local punct_space = lexer.punct + lexer.space

-- Handles flanking delimiters as described in
-- https://github.github.com/gfm/#emphasis-and-strong-emphasis in the cases
-- where simple delimited ranges are not sufficient.
local function flanked_range(s, not_inword)
  local fl_char = lexer.any - s - lexer.space
  local left_fl = lpeg.B(punct_space - s) * s * #fl_char +
                  s * #(fl_char - lexer.punct)
  local right_fl = lpeg.B(lexer.punct) * s * #(punct_space - s) +
                   lpeg.B(fl_char) * s
  return left_fl * (lexer.any - (not_inword and s * #punct_space or s))^0 *
         right_fl
end

lex:add_rule('strong',
             token('strong', flanked_range('**') +
                             (lpeg.B(punct_space) + #lexer.starts_line('_')) *
                             flanked_range('__', true) * #(punct_space + -1)))
lex:add_style('strong', 'bold')

lex:add_rule('em',
             token('em', flanked_range('*') +
                         (lpeg.B(punct_space) + #lexer.starts_line('_')) *
                         flanked_range('_', true) * #(punct_space + -1)))
lex:add_style('em', 'italics')
```

这段代码是出现在Textadept的Markdown lexer中的，所以用到了一些Textadept在lexer.lua里定义好的。这段代码描述的是Markdown中倾斜以及加粗的语法。如果你比较了解Markdown的话，应该知道*是可以用在单词中的，而_不可以。根据Markdown的规范，就会有下面这些：

- `foo*bar*`的效果是foo*bar*，而`foo_bar_`的效果是foo_bar_。
- `a * foo bar*`不会倾斜，`foo-_(bar)_`会倾斜，`_foo_bar_baz_`会整体倾斜成*foo_bar_baz*
- `_(bar)_?`因为最后是标点符号，依然是可以用下划线的，显示效果是 _(bar)_?

说实话我见过很多自称实现Markdown解析的，在这里都做得不符合标准。但用这么几行Lua代码结合LPeg，就可以非常接近标准（因为是代码编辑器，我没有考虑嵌套加粗与倾斜的）。

---

由于我的目的不是写教程，所以上面的例子也不是给大家展示最基础的东西。下面我们再谈回LPeg。那么LPeg究竟是什么呢？我们需要先了解一下**PEG**，也就是**解析表达文法**（Parsing Expression Grammar）。我们搬出维基百科：

> 解析表达文法是一种分析型形式文法。这种文法用一个识别字符串的规则的集合来描述某种形式语言。

为什么说是**分析型**的呢。我前一段时间特地为大家翻译了维基百科的[形式文法](https://zh.wikipedia.org/wiki/形式文法)条目。里面有提到，分析型文法是和大家熟知的**乔姆斯基谱系**不同的体系。分析型文法更注重与语法分析器的结构和语义的对应，我在使用的时候也能感受出来，它的思维比CFG更加直接。在你用PEG定义一个文法的时候，你会自然地绕过CFG中的一些循环定义，而PEG本身也会保证文法不会出现二义性。同时它的实际**表达性**（Expressivity）至少也是超出正则表达式的。

我曾经有一段时间一直以为LPeg不支持懒惰匹配的。这个问题一直是阻碍我继续探索LPeg的一个因素。我在使用LPeg前期一直都是看着官方文档做的。而我前面也说了，官方文档的例子真的有限，所以有些关键部分是了解不到的。直到我最近为了实现Textadept的JS的自动补全，我打开了一篇关于PEG的论文，才真正懂了一点。这篇论文就摆在LPeg官网最上面，但是我一直在看文档，没读过这个。我看了论文才体会到，如果想真正会用LPeg，只看文档是不行的，弄懂PEG才行。这篇论文就是《[A Text Pattern-Matching Tool based on Parsing Expression Grammars](http://www.inf.puc-rio.br/~roberto/docs/peg.pdf)》，是Roberto写的，涉及到了PEG的知识，以及LPeg中PEG的具体实现。

有关PEG有两个我认为的关键词：**有限制的回溯**（restricted backtracking）与**有序选择**（ordered choice）。

- **有限制的回溯**说的是PEG只进行**局部**回溯，也就是说，它只会在一个规则内部有多个选项的地方回溯。只要其中一个选项匹配成功，那么就算这个规则后面匹配不成功，也不会在返回来再取下一个选项，或者把某个`*`或`+`匹配长度缩短来试着匹配。这与正则表达式以及Lua原生的模式匹配都遵循的**最长匹配原则**不同。

- **有序选择**是说PEG里面对于多个选项的规则，用的是`/`运算符，这叫做有序选择运算符。这就与CFG中的`|`运算符存在着本质的不同了。选择上了第一个，就不会再考虑第二个。

这样的规则一开始可能会觉得限制了我们意思的表达。但事实上，它的表达能力依然很强大，对于编程语言来说是够用的。而且它带来的好处稍微想一下就能知道，相比CFG来说，避免了二义性；而相比于正则表达式而言，它匹配的时间是可预测的，因为它有严格的性能模型。虽然维基百科上说，据推测，存在不能用PEG处理的上下文无关语言，但毕竟尚未得到证实。据我所知，Lua本身、JavaScript、CSS，以及[多种数据](https://github.com/daurnimator/lpeg_patterns)都有已实现的PEG解析。

上面提到的那篇论文给我们展示了实现贪婪匹配、懒惰匹配、肯定预查和否定预查，不需要对PEG进行任何的扩展。

---

我之前会有LPeg不支持懒惰匹配的疑问其实是对PEG了解不深才会这样的。其实我那时只会“盲目”贪婪匹配，也是没有回溯的一种贪婪匹配。盲目地匹配尽量多个E<sub>1</sub>，然后跟着匹配E<sub>2</sub>的规则很简单，就是

$$
\text{S} \leftarrow E_1^* \, E_2
$$

说实话一般来说盲目就够用了。在E<sub>1</sub>不是E<sub>2</sub>的前缀的情况下，盲目与非盲目应该是等价的。

---

而“非盲目”的**贪婪匹配**多个E<sub>1</sub>，然后接一个E<sub>2</sub>的写法是

$$
\text{S} \leftarrow E_1 \,\text{S}\, /\, E_2
$$

这个规则会一直尝试匹配E<sub>1</sub>，直到匹配匹配不到E<sub>1</sub>了。如果这时候匹配不到E<sub>2</sub>，这个匹配不会就此结束，因为每一层递归我们都选择了第一个选项，而我们还没有匹配成功，所以我们依然在局部回溯的范围中。PEG引擎会回溯到上一层，尝试选择第二个选项E<sub>2</sub>，如果再次不匹配又会再回溯到上一层递归，直到匹配成功。这时匹配的结果一定是最多个数的E<sub>1</sub>，后面跟一个E<sub>2</sub>。

---

再来说**懒惰匹配**。懒惰匹配多个E<sub>1</sub>，然后接一个E<sub>2</sub>的写法是

$$
\text{S} \leftarrow E_2\, /\, E_1\,\text{S}
$$

这个规则会一层层递归，每次都先匹配E<sub>2</sub>，不匹配则尝试多匹配一个E<sub>1</sub>。只要匹配到一个E<sub>2</sub>，这个递归就会结束。所以这个规则匹配的是最少个数的E<sub>1</sub>，后面跟一个E<sub>2</sub>。

---

另外还有一点需要注意，那就是标准的PEG不支持**左递归**（left recursion）的。那么什么是左递归呢？我们再次搬出维基百科

> 若一个非终结符号（non-terminal）`r`有任何直接的文法规则或者透过多个文法规则，推导出的句型（sentential form）其中最左边的符号又会出现`r`，则我们说这个非终结符号r是左递归的。 

而左递归又可分为**直接左递归**和**间接左递归**。我就简单举个直接左递归例子，方便大家理解它的意思

$$
\text{S} \leftarrow \text{S X}\, / ...
$$

虽然近年来多篇论文研究了系统性消除左递归的方式，但无论是LPeg和PEG.js都没有支持左递归。其实我想，或许Roberto不想去支持左递归。他想鼓励人们去写格式良好（well-formed）的PEG，而非借助编程的方法去化解左递归。

---

我也是看到了上面神奇的用法，才对LPeg重新恢复信心的。而且随后我又看到了另一篇论文《[From regexes to parsing expression grammars](https://www.sciencedirect.com/science/article/pii/S0167642312002171)》，这篇论文详细介绍了如何把正则表达式转换为PEG，并附有严格的证明。这也就印证了我前面说的，它拥有超出正则表达式的表达性。

LPeg有两种风格，一种就像我前面那个例子那样，作者喜欢称它为SNOBOL风格，但我更喜欢叫它“编程式”风格；另一种，作者喜欢称为正则式风格，但我更喜欢称它为“标准式”风格（因为论文里都会采用这种风格）。两种各有好处，编程式方便进行编程和扩展，可以定义一些函数处理捕获，扩展性较强；而标准式呢，我认为便于理解PEG文法的含义，因为呢，加号+我觉得让人感受不到有序选择的意味。我很久以来都没清晰地意识到，LPeg进行的是有序选择。而且编程式的捕获种类太多，什么Cb、Cc、Cf、Cg、Cp，让人看着眼晕，但是在标准式里，我就觉得好很多了。再次拿我写的JS自动补全的文法作为例子吧，虽然它并不一定完美，但真的很好用。

```peg
js_line      <- {| js_expr !. / js_expr_nonstart |}
js_expr_nonstart <- ([^a-zA-Z0-9_$] js_expr / . js_expr_nonstart) !. / . js_expr_nonstart
js_expr      <- ((jq_selector / prev_token) '.' / '') {:part: %a* :}
jq_selector  <- {:symbol: '$' balanced -> 'jQuery.fn' :} func*
func         <- '.' %a+ balanced
prev_token   <- {:symbol: [a-zA-Z0-9_$/'"`]+ :} balanced?
balanced     <- '(' ([^()] / balanced)* ')'
```

简单解释一下这个文法是做什么的。这个文法的作用就是匹配出一个symbol.part的形式。由于jQuery是一个函数接一个函数的风格，而返回值基本上都是jQuery.fn，如果只匹配前一个符号的话是看不出来是不是jQuery的，所以要一致从jQuery的标志（也就是\$符号）开始匹配。我们看到`jq_selector`这个规则就是干这个的，它会匹配`$(...).fn1(...).fn2(...).part`的形式；而`prev_token`这种匹配的就是简单的`symbol.part`或者`symbol(...).part`的形式。从而按照需要进行代码补全。`balanced`这条规则就是PEG用来匹配成对括号的示例代码，非常好用，当然Lua自带的模式匹配也支持成对括号匹配，但真的太弱了，成对括号无法增加?或者是*这种操作，这直接阻挡了我用Lua原生匹配完成这个匹配。

由于我们是从一行的第一个字符开始匹配的，但如果我们代码补全真正想要的永远是刚好匹配到最后一个字符，所以在`js_line`和`js_expr_nonstart`做了处理，如果匹配完发现不是最后一个字符，那就要错一位再尝试。其实思路是很直接的。这个匹配的完成也让我对PEG信心满满。我前段时间甚至还产生了解析SQL的想法，而且还真的去做了。只花了两三天时间就把SQL的主要功能实现了解析，还写了自己的AST输出函数，因为我觉得用现成的inspect输出太影响理解了，而且占用空间也太多。影响人类阅读。

对于一个简单的SQL：

```sql
SELECT DISTINCT a, b FROM c JOIN d ON c.id = d.id
WHERE todo IN(1,2,3)
ORDER BY b ASC
```

输出的样子就像下面这样

```sql
{sql_select:
    {
        SELECT, DISTINCT, 
        {select_elements:
            {select_expr:
                {expr:
                    {condition:
                        {operand:
                            {column_expr: a}
                        }
                    }
                }
            },
            {select_expr:
                {expr:
                    {condition:
                        {operand:
                            {column_expr: b}
                        }
                    }
                }
            }
        }
    },
    {
        FROM, 
        {table_ref:
            {table_factor:
                {table_name: c}
            },
            {join_expr:
                JOIN, 
                {table_factor:
                    {table_name: d}
                },
                ON, 
                {expr:
                    {condition:
                        {operand:
                            {column_expr: c.id}
                        },
                        =, 
                        {operand:
                            {column_expr: d.id}
                        }
                    }
                }
            }
        }
    },
    {
        WHERE, 
        {expr:
            {condition:
                {operand:
                    {column_expr: todo}
                },
                IN, 
                {value: 1},
                {value: 2},
                {value: 3}
            }
        }
    },
    {
        ORDER BY, 
        {order:
            {column_expr: b},
            ASC
        }
    }
}
```

你可以想象这样的结构是怎样用LPeg匹配出来的吗？其实简单来说就是反复运用简单匹配`{ p }`和table匹配`{| p |}`，这其实已经足够强大了。因为我们需要有tag，所以最多再加上一个命名匹配`{:name: p :}`。我想我一定不会去写一个巨型的正则表达式去匹配这个，当然，也没人去这么做。一般解析文法都会用专门的工具了，比如bison。当然徒手写也是一个办法，但怎么说呢，有这样一个形式文法支撑你，会比较放心，而且可读性也好。徒手写的解析器你绝对免不了看到一个或者多个长长的switch语句的。在这一点上，我确实非常佩服发明自动机的人。LPeg的背后就是一个自动机，只要把我的模式编译一下，就可以一直用它去匹配。

用LPeg创造解析器是可以词法分析和语法分析一体的。这一点我用了一阵之后才发现。我用LPeg分析SQL其实有参考其他好几个实现的。其中一个就是[tclh123/lpeg-sql](https://github.com/tclh123/lpeg-sql)，我觉得是非常有参考价值的。但他的文法没有考虑太多情况。我想用他的文法可能只能匹配极为简单的SQL吧。由于我有一个更大的目标，打算利用SQL解析去做些什么，所以我用我的文法测试了目前公司项目中实际的SQL，保证了它们都能通过我的解析，而不是匹配到一半就匹配不上了。

就像我前面说的那样，你在写一个PEG文法的时候，你就会留意优先级的问题。然后按照优先的顺序排列一条规则。比如，函数的优先级一定是比`column_expr`要高的。因为不管是`column_expr`还是`table_factor`，它们的后面有一个可有可无的`alias`，而PEG里一旦认为匹配成功了，就完全不会考虑下一个选项是什么，但也许，遇到的是一组括号，也就是我们的函数，但为时已晚，匹配失败。还有就是，如果你不限定规则，保留字与`name`之间是会有很多情况会匹配错的。因为如果你没有保留字的规定，那么`name`本本身是完全可以有保留字构成的，从字符组成上来看。还好PEG里面可以用**否定断言**，我刚才还在想如果在正则里，要叫做**前向否定预判**呢。通过下面一条规则

```peg
name <- !reserved ([0-9a-zA-Z$_]+ / ["`] [^"`]+ ["`])
```

就搞定了。我曾经设想过如果没有这个，我可能要用到有序选择，而且还需要重写一些规则，才能保证name取不到标识符。但还好有这个“高级”算符。由于我看其他参考里联表`JOIN`的文法都写得不太好，我就参考了MySQL官方文档里的文法，但就是在这里我第一次遇到了传说中的**左递归**。我摘录一下我略微简化过的官方定义的文法，这很明显是一个CFG：

```sql
table_references:
    table_reference [, table_reference] ...

table_reference:
    table_factor
  | joined_table

table_factor:
    tbl_name [PARTITION (partition_names)]
        [[AS] alias] [index_hint_list]
  | table_subquery [AS] alias [(col_list)]
  | ( table_references )

joined_table:
    table_reference {[INNER | CROSS] JOIN | STRAIGHT_JOIN} table_factor [join_specification]
  | table_reference {LEFT|RIGHT} [OUTER] JOIN table_reference join_specification
  | table_reference NATURAL [INNER | {LEFT|RIGHT} [OUTER]] JOIN table_factor

join_specification:
    ON search_condition
  | USING (join_column_list)
```

我当时对左递归不太了解，所以直接翻译成了PEG，结果如大家所料，LPeg报错了。于是乖乖去翻了半天博客和论文。大家可以发现上面的文法涉及的就是那种不好转化的`joined_table`的间接左递归，我们来看一下这个是为什么有左递归

```
joined_table <- table_reference ... <- joined_table ...
```

我的解决办法就是不用`joined_table`这条规则，如果不搞掉这条规则可能会很难消掉这个左递归。不过我们需要理解这样的文法是想表达什么，因为我们有SQL的经验，我们知道这其实就是一个table可以连续`JOIN`好几个table，所以我修改了`table_ref`的定义，这个定义没有递归，直接就是前面提到的“盲目”贪婪匹配，一次性贪婪地把后面所有的`join_expr`都匹配上了，很简洁。

```sql
table_refs   <- table_ref (%s* ',' %s* table_ref)*
table_ref    <- table_factor (%s+ join_expr)*
table_factor <- (table_name / subquery) (%s+ (AS %s+)? alias)? / '(' %s* table_refs %s* ')'
join_expr    <- (( (LEFT / RIGHT) (%s+ OUTER)? / INNER / CROSS / NATURAL) %s+)?
                JOIN %s+ table_factor (%s+ join_spec)? |}
join_spec    <- ON %s+ expr / USING %s* '(' %s* name (%s* ',' %s* name)* %s* ')'
```

我写这篇博客的一个原因是，我看到关于PEG的中文资料非常少，英文资料也不算多。我很希望我这篇实践能给大家帮助，让大家尝试一下PEG这种文法。大家或许知道，2019年7月2日，Cloudflare因为正则表达式导致其服务中一个关键组件的CPU使用率大幅上升，出现了一次全球宕机。下面就是Cloudflare写的正则，它会导致**灾难性回溯**（catastrophic backtracking）。[^cloudflare]

```regex
(?:(?:\"|'|\]|\}|\\|\d|(?:nan|infinity|true|false|null|undefined|symbol|math)|\`|\-|\+)+[)]*;?((?:\s|-|~|!|{}|\|\||\+)*.*(?:.*=.*)))
```

正则表达式确实不好读懂对吧。至少对于复杂的pattern是这样的。不光不好读懂，还不好调试。就像rosie-lang的网页上说的，如果把它转化成PEG文法的话，便不会有这样的问题。[∎](../ "返回首页")

[^technopedia]: What is Pattern Matching? - Definition from Techopedia, https://www.techopedia.com/definition/8801/pattern-matching
[^cloudflare]: Practical PEGs, https://rosie-lang.org/blog/2019/07/18/practicalpegs.html