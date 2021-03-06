MM.Item = function() {
	this._parent = null;
	this._children = [];

	this._layout = null;
	this._shape = null;
	this._autoShape = true;
	this._color = null;
	this._value = null;
	this._status = null;
	this._side = null; /* side preference */
	this._id = MM.generateId();
	this._oldText = "";

	this._computed = {
		value: 0,
		status: null
	}

	this._dom = {
		node: document.createElement("li"),
		content: document.createElement("div"),
		status: document.createElement("span"),
		value: document.createElement("span"),
		text: document.createElement("div"),
		children: document.createElement("ul"),
		canvas: document.createElement("canvas")
	}
	this._dom.node.classList.add("item");
	this._dom.content.classList.add("content");
	this._dom.status.classList.add("status");
	this._dom.value.classList.add("value");
	this._dom.text.classList.add("text");
	this._dom.children.classList.add("children");
	this._dom.node.appendChild(this._dom.canvas);
	this._dom.node.appendChild(this._dom.content);
}

MM.Item.COLOR = "#999";

    /* RE explanation:
     *          _________________________________________________________________________ One of the three possible variants
     *           ____________________ scheme://x
     *                                ___________________________ aa.bb.cc
     *                                                            _______________________ aa.bb/
     *                                                                                    ______ path, search
     *                                                                                          __________________________ end with a non-forbidden char
     *                                                                                                                    ______ end of word or end of string
     */                                                                                                                           
MM.Item.RE = /\b(([a-z][\w-]+:\/\/\w)|(([\w-]+\.){2,}[a-z][\w-]+)|([\w-]+\.[a-z][\w-]+\/))[^\s]*([^\s,.;:?!<>\(\)\[\]'"])?($|\b)/i;

MM.Item.fromJSON = function(data) {
	return new this().fromJSON(data);
}

/**
 * Only when creating a new item. To merge existing items, use .mergeWith().
 */
MM.Item.prototype.fromJSON = function(data) {
	this.setText(data.text);
	if (data.id) { this._id = data.id; }
	if (data.side) { this._side = data.side; }
	if (data.color) { this._color = data.color; }
	if (data.value) { this._value = data.value; }
	if (data.status) { this._status = data.status; }
	if (data.layout) { this._layout = MM.Layout.getById(data.layout); }
	if (data.shape) { this.setShape(MM.Shape.getById(data.shape)); }
	if (data.shape) { this.setShape(MM.Shape.getById(data.shape)); }

	(data.children || []).forEach(function(child) {
		this.insertChild(MM.Item.fromJSON(child));
	}, this);

	return this;
}

MM.Item.prototype.toJSON = function() {
	var data = {
		id: this._id,
		text: this.getText()
	}
	
	if (this._side) { data.side = this._side; }
	if (this._color) { data.color = this._color; }
	if (this._value) { data.value = this._value; }
	if (this._status) { data.status = this._status; }
	if (this._layout) { data.layout = this._layout.id; }
	if (!this._autoShape) { data.shape = this._shape.id; }
	if (this._children.length) {
		data.children = this._children.map(function(child) { return child.toJSON(); });
	}

	return data;
}

MM.Item.prototype.clone = function() {
	var data = this.toJSON();

	var removeId = function(obj) {
		delete obj.id;
		obj.children && obj.children.forEach(removeId);
	}
	removeId(data);

	return this.constructor.fromJSON(data);
}

MM.Item.prototype.update = function(doNotRecurse) {
	MM.publish("item-change", this);

	var map = this.getMap();
	if (!map || !map.isVisible()) { return this; }

	if (this._autoShape) { /* check for changed auto-shape */
		var autoShape = this._getAutoShape();
		if (autoShape != this._shape) {
			if (this._shape) { this._shape.unset(this); }
			this._shape = autoShape;
			this._shape.set(this);
		}
	}
	
	this._updateStatus();
	this._updateValue();
	this.getLayout().update(this);
	this.getShape().update(this);
	if (!this.isRoot() && !doNotRecurse) { this._parent.update(); }

	return this;
}

MM.Item.prototype.updateSubtree = function(isSubChild) {
	this._children.forEach(function(child) {
		child.updateSubtree(true);
	});
	return this.update(isSubChild);
}

MM.Item.prototype.setText = function(text) {
	this._dom.text.innerHTML = text.replace(/\n/g, "<br/>");
	this._findLinks(this._dom.text);
	return this.update();
}

MM.Item.prototype.getText = function() {
	return this._dom.text.innerHTML.replace(/<br\s*\/?>/g, "\n");
}

MM.Item.prototype.setValue = function(value) {
	this._value = value;
	return this.update();
}

MM.Item.prototype.getValue = function() {
	return this._value;
}

MM.Item.prototype.getComputedValue = function() {
	return this._computed.value;
}

MM.Item.prototype.setStatus = function(status) {
	this._status = status;
	return this.update();
}

MM.Item.prototype.getStatus = function() {
	return this._status;
}

MM.Item.prototype.getComputedStatus = function() {
	return this._computed.status;
}

MM.Item.prototype.setSide = function(side) {
	this._side = side;
	return this;
}

MM.Item.prototype.getSide = function() {
	return this._side;
}

MM.Item.prototype.getChildren = function() {
	return this._children;
}

MM.Item.prototype.setColor = function(color) {
	this._color = color;
	return this.updateSubtree();
}

MM.Item.prototype.getColor = function() {
	return this._color || (this.isRoot() ? MM.Item.COLOR : this._parent.getColor());
}

MM.Item.prototype.getOwnColor = function() {
	return this._color;
}

MM.Item.prototype.getLayout = function() {
	return this._layout || this._parent.getLayout();
}

MM.Item.prototype.getOwnLayout = function() {
	return this._layout;
}

MM.Item.prototype.setLayout = function(layout) {
	this._layout = layout;
	return this.updateSubtree();	
}

MM.Item.prototype.getShape = function() {
	return this._shape;
}

MM.Item.prototype.getOwnShape = function() {
	return (this._autoShape ? null : this._shape);
}

MM.Item.prototype.setShape = function(shape) {
	if (this._shape) { this._shape.unset(this); }

	if (shape) {
		this._autoShape = false;
		this._shape = shape;
	} else {
		this._autoShape = true;
		this._shape = this._getAutoShape();
	}

	this._shape.set(this);
	return this.update();
}

MM.Item.prototype.getDOM = function() {
	return this._dom;
}

MM.Item.prototype.getMap = function() {
	var item = this._parent;
	while (item) {
		if (item instanceof MM.Map) { return item; }
		item = item.getParent();
	}
	return null;
}

MM.Item.prototype.getParent = function() {
	return this._parent;
}

MM.Item.prototype.isRoot = function() {
	return (this._parent instanceof MM.Map);
}

MM.Item.prototype.setParent = function(parent) {
	this._parent = parent;
	return this.updateSubtree();
}

MM.Item.prototype.insertChild = function(child, index) {
	/* Create or remove child as necessary. This must be done before computing the index (inserting own child) */
	var newChild = false;
	if (!child) { 
		child = new MM.Item();
		newChild = true;
	} else if (child.getParent()) {
		child.getParent().removeChild(child);
	}

	if (!this._children.length) {
		this._dom.node.appendChild(this._dom.children);
	}

	if (arguments.length < 2) { index = this._children.length; }
	
	var next = null;
	if (index < this._children.length) { next = this._children[index].getDOM().node; }
	this._dom.children.insertBefore(child.getDOM().node, next);
	this._children.splice(index, 0, child);
	
	return child.setParent(this);
}

MM.Item.prototype.removeChild = function(child) {
	var index = this._children.indexOf(child);
	this._children.splice(index, 1);
	var node = child.getDOM().node;
	node.parentNode.removeChild(node);
	
	child.setParent(null);
	
	if (!this._children.length) {
		this._dom.children.parentNode.removeChild(this._dom.children);
	}
	
	return this.update();
}

MM.Item.prototype.startEditing = function() {
	this._oldText = this.getText();
	this._dom.text.contentEditable = true;
	this._dom.text.focus();
	document.execCommand("styleWithCSS", null, false);
	return this;
}

MM.Item.prototype.stopEditing = function() {
	this._dom.text.blur();
	this._dom.text.contentEditable = false;
	var result = this._dom.text.innerHTML;
	this._dom.text.innerHTML = this._oldText;
	this._oldText = "";
	return result;
}

MM.Item.prototype._getAutoShape = function() {
	var depth = 0;
	var node = this;
	while (!node.isRoot()) {
		depth++;
		node = node.getParent();
	}
	switch (depth) {
		case 0: return MM.Shape.Ellipse;
		case 1: return MM.Shape.Box;
		default: return MM.Shape.Underline;
	}
}

MM.Item.prototype._updateStatus = function() {
	this._dom.status.className = "status";
	this._dom.status.style.display = "";

	var status = this._status;
	if (this._status == "maybe") {
		var childrenStatus = this._children.every(function(child) {
			return (child.getComputedStatus() !== false);
		});
		status = (childrenStatus ? "yes" : "no");
	}

	switch (status) {
		case "yes":
			this._dom.status.classList.add("yes");
			this._computed.status = true;
		break;

		case "no":
			this._dom.status.classList.add("no");
			this._computed.status = false;
		break;

		default:
			this._computed.status = null;
			this._dom.status.style.display = "none";
		break;
	}
}

MM.Item.prototype._updateValue = function() {
	this._dom.value.style.display = "";

	if (typeof(this._value) == "number") {
		this._computed.value = this._value;
		this._dom.value.innerHTML = this._value;
		return;
	}
	
	var childValues = this._children.map(function(child) {
		return child.getComputedValue();
	});
	
	var result = 0;
	switch (this._value) {
		case "sum":
			result = childValues.reduce(function(prev, cur) {
				return prev+cur;
			}, 0);
		break;
		
		case "avg":
			var sum = childValues.reduce(function(prev, cur) {
				return prev+cur;
			}, 0);
			result = (childValues.length ? sum/childValues.length : 0);
		break;
		
		case "max":
			result = Math.max.apply(Math, childValues);
		break;
		
		case "min":
			result = Math.min.apply(Math, childValues);
		break;
		
		default:
			this._computed.value = 0;
			this._dom.value.innerHTML = "";
			this._dom.value.style.display = "none";
			return;
		break;
	}
	
	this._computed.value = result;
	this._dom.value.innerHTML = (Math.round(result) == result ? result : result.toFixed(3));
}

MM.Item.prototype._findLinks = function(node) {

	var children = [].slice.call(node.childNodes);
	for (var i=0;i<children.length;i++) {
		var child = children[i];
		switch (child.nodeType) {
			case 1: /* element */
				if (child.nodeName.toLowerCase() == "a") { continue; }
				this._findLinks(child);
			break;
			
			case 3: /* text */
				var result = child.nodeValue.match(this.constructor.RE);
				if (result) {
					var before = child.nodeValue.substring(0, result.index);
					var after = child.nodeValue.substring(result.index + result[0].length);
					var link = document.createElement("a");
					link.innerHTML = link.href = result[0];
					
					if (before) {
						node.insertBefore(document.createTextNode(before), child);
					}

					node.insertBefore(link, child);
					
					if (after) {
						child.nodeValue = after;
						i--; /* re-try with the aftertext */
					} else {
						node.removeChild(child);
					}
				}
			break;
		}
	}
}
