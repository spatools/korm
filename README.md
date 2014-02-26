# KORM [![Build Status](https://travis-ci.org/spatools/korm.png)](https://travis-ci.org/spatools/korm) [![Bower version](https://badge.fury.io/bo/korm.png)](http://badge.fury.io/bo/korm) [![NuGet version](https://badge.fury.io/nu/korm.png)](http://badge.fury.io/nu/korm)

Knockout Utilities Extensions to simplify Knockout app development.

## Installation

Using Bower:

```console
$ bower install korm --save
```

Using NuGet: 

```console
$ Install-Package KORM
```

## Usage

You could use korm in different context.

### Browser (AMD from source)

#### Configure RequireJS.

```javascript
requirejs.config({
    paths: {
        knockout: 'path/to/knockout',
        underscore: 'path/to/underscore',
        koutils: 'path/to/koutils',
        korm: 'path/to/korm'
    }
});
```

#### Load modules

```javascript
define(["korm/datacontext"], function(context) {
    context.create(...);
});
```

### Browser (with built file)

Include built script in your HTML file.

```html
<script type="text/javascript" src="path/to/knockout.js"></script>
<script type="text/javascript" src="path/to/underscore.js"></script>
<script type="text/javascript" src="path/to/koutils.min.js"></script>
<script type="text/javascript" src="path/to/korm.min.js"></script>
```

## Documentation

Documentation is hosted on [Github Wiki](https://github.com/spatools/korm/wiki).