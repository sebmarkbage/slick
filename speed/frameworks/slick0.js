var slick = (function(){
	
	// MAIN Method: searches a context for an expression.
	
	function slick(context, expression){

		slick.buffer = {};
		
		var mySplitters = [];

		var selectors = expression.replace(regExps.splitter, function(m0, m1, m2){
			mySplitters.push(m1);
			return ':)' + m2;
		}).split(':)');

		var items;
		
		for (var i = 0, l = selectors.length; i < l; i++){
			
			var selector = selectors[i];

			if (i == 0 && regExps.quick.test(selector)){
				items = context.getElementsByTagName(selector);
				continue;
			}
			
			var tagID = parseTagAndID(selector), tag = tagID[0], id = tagID[1], parsed = parseSelector(selector);
			
			if (i == 0){
				items = getNodesBySelector(context, tag, id, parsed, null);
			} else {
				var splitter = splitters[mySplitters[i - 1]], found = [];
				slick.buffer.uniques = {};
				for (var j = 0, k = items.length; j < k; j++) found = splitter(found, items[j], tag, id, parsed);
				items = found;
			}

		}

		return items;
	};
	
	// pseudoselectors accessors
	
	slick.addPseudoSelector = function(name, fn){
		pseudos[name] = fn;
	};
	
	slick.getPseudoSelector = function(name){
		return pseudos[name];
	};
	
	// default getAttribute
	
	slick.getAttribute = function(node, name){
		return node.getAttribute(name);
	};
	
	slick.match = function(node, selector){
		if (!selector || (selector == node)) return true;
		slick.buffer = {};
		var tagID = parseTagAndID(selector);
		var matches = matchNodeBySelector(node, tagID[0], tagID[1], parseSelector(selector), null, {});
		return matches;
	};
	
	// PRIVATE STUFF! Cant touch! AHAHA
	
	// cache
	
	var cache = {selectors: {}, nth: {}};
	
	// commonly used regexps.
	
	var regExps = {
		id: (/#([\w-]+)/),
		tag: (/^(\w+|\*)/),
		quick: (/^(\w+|\*)$/),
		splitter: (/\s*([+>~\s])\s*([a-zA-Z#.*:\[])/g),
		combined: (/\.([\w-]+)|\[(\w+)(?:([!*^$~|]?=)(["']?)([^\4]*?)\4)?\]|:([\w-]+)(?:\(["']?(.*?)?["']?\)|$)/g)
	};
	
	// generates and returns, or simply returns if existing, an unique id for a Node.
	
	var uidOf = (function(){
		var index = 1;
		if (window.ActiveXObject) return function uidOf(item){
			return (item.uid || (item.uid = [index++]))[0];
		};
		return function uidOf(item){
			return (item.uid || (item.uid = index++));
		};
	})();
	
	//pseudos
	
	// utility function for the nth pseudo selector, parses the complex argument.
	
	function parseNTHArgument(argument){
		if (cache.nth[argument]) return cache.nth[argument];
		var parsed = argument.match(/^([+-]?\d*)?([a-z]+)?([+-]?\d*)?$/);
		if (!parsed) return false;
		var inta = parseInt(parsed[1], 10);
		var a = (inta || inta === 0) ? inta : 1;
		var special = parsed[2] || false;
		var b = parseInt(parsed[3], 10) || 0;
		if (a != 0){
			b--;
			while (b < 1) b += a;
			while (b >= a) b -= a;
		} else {
			a = b;
			special = 'index';
		}
		switch (special){
			case 'n': parsed = {a: a, b: b, special: 'n'}; break;
			case 'odd': parsed = {a: 2, b: 0, special: 'n'}; break;
			case 'even': parsed = {a: 2, b: 1, special: 'n'}; break;
			case 'first': parsed = {a: 0, special: 'index'}; break;
			case 'last': parsed = {special: 'last-child'}; break;
			case 'only': parsed = {special: 'only-child'}; break;
			default: parsed = {a: (a - 1), special: 'index'};
		}

		return cache.nth[argument] = parsed;
	};
	
	var pseudos = {

		// w3c pseudo selectors

		'checked': function(){
			return this.checked;
		},

		'empty': function(){
			return !(this.innerText || this.textContent || '').length;
		},

		'not': function(selector){
			return !slick.match(this, selector);
		},

		'contains': function(text){
			return ((this.innerText || this.textContent || '').indexOf(text) > -1);
		},

		'first-child': function(){
			return pseudos.index.call(this, 0);
		},

		'last-child': function(){
			var element = this;
			while ((element = element.nextSibling)){
				if (element.nodeType == 1) return false;
			}
			return true;
		},

		'only-child': function(){
			var prev = this;
			while ((prev = prev.previousSibling)){
				if (prev.nodeType == 1) return false;
			}
			var next = this;
			while ((next = next.nextSibling)){
				if (next.nodeType == 1) return false;
			}
			return true;
		},

		'nth-child': function(argument){
			argument = (argument == null) ? 'n' : argument;
			var parsed = parseNTHArgument(argument);
			if (parsed.special != 'n') return pseudos[parsed.special].call(this, parsed.a);
			var count = 0;
			var buffer = slick.buffer;
			if (!buffer.positions) buffer.positions = {};
			var uid = uidOf(this);
			if (!buffer.positions[uid]){
				var self = this;
				while ((self = self.previousSibling)){
					if (self.nodeType != 1) continue;
					count ++;
					var position = buffer.positions[uidOf(self)];
					if (position != null){
						count = position + count;
						break;
					}
				}
				buffer.positions[uid] = count;
			}
			return (buffer.positions[uid] % parsed.a == parsed.b);
		},

		// custom pseudo selectors

		index: function(index){
			var element = this, count = 0;
			while ((element = element.previousSibling)){
				if (element.nodeType == 1 && ++count > index) return false;
			}
			return (count == index);
		},

		even: function(argument){
			return pseudos['nth-child'].call(this, '2n+1');
		},

		odd: function(argument){
			return pseudos['nth-child'].call(this, '2n');
		}

	};
	
	// fast indexOf with a separator (' ') checking.
	
	function stringContains(source, string, separator){
		separator = separator || '';
		return (separator + source + separator).indexOf(separator + string + separator) > -1;
	};
	
	// checks if a Node is in the "uniques" object literal. If its not, returns true and sets its uid, otherwise returns false.
	// If an uniques object is not passed, the function returns true.
	
	function pushedNodeInUniques(node){
		var sbu = slick.buffer.uniques;
		if (!sbu) return true;
		var uid = uidOf(node);
		if (!sbu[uid]) return sbu[uid] = true;
		return false;
	};
	
	// parses tagName and ID from a selector, and returns an array [tag, id]
	
	function parseTagAndID(selector){
		var tag = selector.match(regExps.tag);
		var id = selector.match(regExps.id);
		return [(tag) ? tag[1] : '*', (id) ? id[1] : false];
	};
	
	// parses a selector (classNames, attributes, pseudos) into an object and saves it in the cache for faster re-parsing.
	
	function parseSelector(selector){
		if (cache.selectors[selector]) return cache.selectors[selector];
		var m, parsed = {classes: [], pseudos: [], attributes: []};
		while ((m = regExps.combined.exec(selector))){
			var cn = m[1], an = m[2], ao = m[3], av = m[5], pn = m[6], pa = m[7];
			if (cn){
				parsed.classes.push(cn);
			} else if (pn){
				var parser = pseudos[pn];
				if (parser) parsed.pseudos.push({parser: parser, argument: pa});
				else parsed.attributes.push({name: pn, operator: '=', value: pa});
			} else if (an){
				parsed.attributes.push({name: an, operator: ao, value: av});
			}
		}
		if (!parsed.classes.length) delete parsed.classes;
		if (!parsed.attributes.length) delete parsed.attributes;
		if (!parsed.pseudos.length) delete parsed.pseudos;
		if (!parsed.classes && !parsed.attributes && !parsed.pseudos) parsed = null;
		return cache.selectors[selector] = parsed;
	};
	
	// methods to match a node against tag, id, className, attribute and pseudo
	
	function matchNodeByTag(node, tag){
		return (tag == '*' || (node.tagName && node.tagName.toLowerCase() == tag));
	};
	
	function matchNodeByID(node, id){
		return (!id || (node.id && node.id == id));
	};
	
	function matchNodeByClass(node, className){
		return (node.className && stringContains(node.className, className, ' '));
	};
	
	function matchNodeByPseudo(node, parser, argument){
		return parser.call(node, argument);
	};
	
	function matchNodeByAttribute(node, name, operator, value){
		var result = slick.getAttribute(node, name);
		if (!result) return (operator == '!=');
		if (!operator || value == null) return true;
		switch (operator){
			case '=': return (result == value);
			case '*=': return (result.indexOf(value) > -1);
			case '^=': return (result.substr(0, value.length) == value);
			case '$=': return (result.substr(result.length - value.length) == value);
			case '!=': return (result != value);
			case '~=': return stringContains(result,value, ' ');
			case '|=': return stringContains(result, value, '-');
		}
		return false;
	};
	
	// matches a node against a parsed selector
	
	function matchNodeBySelector(node, tag, id, parsed){
		if (slick.buffer.uniques && !pushedNodeInUniques(node)) return false;
		if (tag && !matchNodeByTag(node, tag)) return false;
		if (id && !matchNodeByID(node, id)) return false;
		
		if (!parsed) return true; //no parsers
		
		var i;
		if (parsed.classes){
			for (i = parsed.classes.length; i--; i){
				var cn = parsed.classes[i];
				if (!matchNodeByClass(node, cn)) return false;
			}
		}
		if (parsed.attributes){
			for (i = parsed.attributes.length; i--; i){
				var att = parsed.attributes[i];
				if (!matchNodeByAttribute(node, att.name, att.operator, att.value)) return false;
			}
		}
		if (parsed.pseudos){
			for (i = parsed.pseudos.length; i--; i){
				var psd = parsed.pseudos[i];
				if (!psd.parser.call(node, psd.argument)) return false;
			}
		}
		return true;
	};
	
	// retrieves elements by tag and id, based on context.
	// In case an id is passed, an array containing one element will be returned (or empty, if no id was found).
	
	function getNodesBySelector(context, tag, id, parsed){
		if (id && context.getElementById){
			var node = context.getElementById(id);
			if (node && !matchNodeBySelector(node, tag, null, parsed)) node = null;
			return (node) ? [node] : [];
		}
		return splitters[' ']([], context, tag, id, parsed);
	};
	
	// splitters
	
	var splitters = {

		' ': function allChildren(found, node, tag, id, parsed){
			var children = node.getElementsByTagName(tag);
			for (var i = 0, l = children.length; i < l; i++){
				if (matchNodeBySelector(children[i], null, id, parsed)) found.push(children[i]);
			}
			return found;
		},

		'>': function allSiblings(found, node, tag, id, parsed){
			var children = node.getElementsByTagName(tag);
			for (var i = 0, l = children.length; i < l; i++){
				var child = children[i];
				if (child.parentNode == node && matchNodeBySelector(child, null, id, parsed)) found.push(child);
			}
			return found;
		},

		'+': function nextSibling(found, node, tag, id, parsed){
			while ((node = node.nextSibling)){
				if (node.nodeType == 1){
					if (matchNodeBySelector(node, tag, id, parsed)) found.push(node);
					break;
				}
			}
			return found;
		},

		'~': function nextSiblings(found, node, tag, id, parsed){
			while ((node = node.nextSibling)){
				if (node.nodeType == 1){
					if (!pushedNodeInUniques(node)) break;
					if (matchNodeBySelector(node, tag, id, parsed, null)) found.push(node);
				}
			}
			return found;
		}

	};
	
	return slick;
	
})();

document.search = function(expression){
	return slick(document, expression);
};