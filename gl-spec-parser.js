var fs = require('fs');
var microdom = require('microdom');
var inherits = require('util').inherits;

var commandsArray = [];
var commandDefs = {};

// TODO: pass the current name path down for filtering

function Command(attrs) {
  microdom.MicroNode.apply(this, arguments);

  if (attrs.name) {
    commandsArray.push(this);
  } else {
    var node = this;
    this.once('done', function afterChildren() {

      var obj = {
        type: 'void',
        name: '',
        params: null
      };

      var proto = node.named('proto');
      obj.name = proto.textOf('name');
      obj.type = proto.textOf('ptype', proto.child(0).text());

      var ptrexp = /(\*)/g

      obj.params = node.named('param', true).map(function(pel) {

        var len = pel.attr('len') || 1;
        var parsedLen = parseInt(len);
        if (!isNaN(parsedLen)) {
          len = parsedLen;
        }

        var pointer = pel.children().filter(function(child) {
          if (child.name === 'text') {
            var text = child.text();
            return (text.indexOf('*') > -1) ? text : false;
          }
          return false;
        });

        var param = {
          group : pel.attributes.group || null,
          type: pel.textOf('ptype', pel.child(0).text()).replace(ptrexp, '').trim(),
          name: pel.textOf('name'),
          len: len,
          constant: pel.child(0).text().indexOf('const') > -1,
          // track pointer depth by no=0, *=1, **=2
          pointer: ((pel.child(0).text() || '').match(ptrexp) || []).length
        };

        // TODO: handle pointers
        /* TODO: handle double points `**` as in
          <command>
              <proto><ptype>GLuint</ptype> <name>glCreateShaderProgramvEXT</name></proto>
              <param><ptype>GLenum</ptype> <name>type</name></param>
              <param><ptype>GLsizei</ptype> <name>count</name></param>
              <param len="count">const <ptype>GLchar</ptype> **<name>strings</name></param>
          </command>

          or

          <command>
              <proto>void <name>glDebugMessageInsert</name></proto>
              <param><ptype>GLenum</ptype> <name>source</name></param>
              <param><ptype>GLenum</ptype> <name>type</name></param>
              <param><ptype>GLuint</ptype> <name>id</name></param>
              <param><ptype>GLenum</ptype> <name>severity</name></param>
              <param><ptype>GLsizei</ptype> <name>length</name></param>
              <param len="COMPSIZE(buf,length)">const <ptype>GLchar</ptype> *<name>buf</name></param>
          </command>
        */

        return param;
      });

      // handle aliases
      obj.aliases = node.named('alias', true).map(function(alias) {
        return alias.attr('name');
      });

      commandDefs[obj.name] = obj;
    });
  }
}

inherits(Command, microdom.MicroNode);

microdom.tag('command', Command);

microdom.plugin({
  elements : function() {
    return this.children().filter(function(child) {
      return child.name && child.name !== 'text';
    });
  },
  text: function() {
    if (this.name === 'text') {
      return this.value.trim();
    } else {
      return this.child(0).value.trim();
    }
  },
  named : function(name, multiple) {
    var r = this.children().filter(function(child) {
      return child.name === name;
    });

    if (!multiple) {
      return r.length ? r[0] : null;
    } else {
      return r;
    }
  },
  textOf : function(name, defaultText) {
    var el = this.named(name);
    if (el) {
      return el.text();
    } else {
      return defaultText || null;
    }
  }
})

fs.createReadStream(__dirname + '/tmp/gl.xml')
  .pipe(microdom.createParserStream(null, true))
  .on('dom', function(dom) {

    commandsArray.filter(function(cmd) {

      return cmd.parent.name === 'require' &&
             cmd.parent.parent.attr('api') === 'gles2'
    }).map(function(cmd) {
      return cmd.attr('name');
    }).map(function(name) {
      console.log(commandDefs[name]);
    })
  });
