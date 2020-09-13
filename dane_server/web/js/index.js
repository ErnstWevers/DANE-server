function debounce (fn, delay) {
  var timeoutID = null
  return function () {
    clearTimeout(timeoutID)
    var args = arguments
    var that = this
    timeoutID = setTimeout(function () {
      fn.apply(that, args)
    }, delay)
  }
}

Vue.component('dane-document', {
  template: '#dane-document',
  props: ['doc_id'],
  data: function() {
    return {
      doc: {},
      errored: false,
      attempts: 0,
      dialog: false,
      loading: true,
      tasks: []
    }
  }, 
  created: function() {
      this.load();
    },
  watch: {
    doc_id: function(n, o) { if (n != o) this.load(); }
  },
  methods: {
      load: function() {
        fetch(new URL(`document/${this.doc_id}`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            this.errored = true;
            this.loading = false;
            throw Error(resp.statusText);
          }
          return resp.json() 
        })
        .then(data => {
          this.doc = data;
          this.loading = false;
          this.loadTasks();
          })
        .catch(error => {
          // because network errors are type errors..
          if (error.name == 'TypeError') {
            this.loading = false;
            this.errored = true;
          }
          throw error;
        });
      },
      loadTasks: function() {
        fetch(new URL(`document/${this.doc._id}/tasks`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            this.errored = true;
            this.loading = false;
            throw Error(resp.statusText);
          }
          return resp.json() 
        })
        .then(data => {
          this.tasks = data;
          this.loading = false;
          })
        .catch(error => {
          // because network errors are type errors..
          if (error.name == 'TypeError') {
            this.loading = false;
            this.errored = true;
          }
          throw error;
        });
      },
      deleteDoc: function() {
      vm.$refs.confirm.open('Delete document', 'Are you sure you want to delete this document?', 
        { color: 'warning' }).then((confirm) => {
          if (confirm) {
            fetch(new URL(`document/${this.doc_id}/delete`, Config.API).href) 
              .then((resp) => {
                if (!resp.ok) {
                  throw Error(resp.statusText, resp.status);
                }
                this.job = {};
                this.$emit('deleteddoc')
              })
            .catch(error => {
              if (error.fileName == 404) {
                this.errored = true;
                throw error
              }
              this.attempts++;
              if (this.attempts < 5) {
                setTimeout(this.load, (500 * Math.pow(2, this.attempts)));
              } else {
                this.errored = true;
                throw error;
              }
            })
          }
        })
    },
      newVal: function(task) {
      this.tasks.find((o, i) => {
        if (o._id == task._id) {
          if (task.state == "000") {
              this.$delete(this.tasks, i);
          } else {
            Vue.set(this.tasks, i, {});
            setTimeout(() => { // add delay so we see change
              Vue.set(this.tasks, i, task);
            }, 10);
          }
          return true;
        }
      });
     }
   }
})

Vue.component('dane-doc-search', {
  template: '#dane-doc-search',
   data: function() {
      return {
        results: [],
        headers: [
          { 'text': 'id', value: '_id' },
          { 'text': 'target', value: 'target.id' },
          { 'text': 'type', value: 'target.type' },
          { 'text': 'creator', value: 'creator.id' }
        ]
      }
    },
    methods: {
      clickRow: function(value) {
        vm.switchDoc(value._id);
      }
    }
})

Vue.component('dane-doc-searchbar', {
  template: '#dane-doc-searchbar',
  data: function() {
      return {
        target: "",
        creator: "",
        docs: []
      }
    }, 
  created: function() {
    this.search();
  },
  methods: {
    search: function() {
      let t = ((this.target.length > 0) ? this.target : '*');
      let c = ((this.creator.length > 0) ? this.creator : '*');
      fetch(new URL(`document/search/${t}/${c}`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            this.docs = [];
            this.$emit('input', this.docs);
            throw Error(resp.statusText);
          }
          return resp.json() 
        })
        .then(data => {
            this.docs = data;
            this.$emit('input', this.docs);
          })
        .catch(error => {
          // because network errors are type errors..
          if (error.name == 'TypeError') {
            this.docs = [];
            this.$emit('input', this.docs);
          }
          throw error;
        });
     }
  }
})

Vue.component('dane-tasklist', {
  template: '#dane-tasklist',
  props: ['value'],
   data: function() {
      return {
        errored: false,
      }
    },
  methods: {
      retryTask: function(id) {
        this.doAction(id, 'retry');
      },
      resetTask: function(id) {
        this.doAction(id, 'reset');
      },
      forceRetryTask: function(id) {
        this.doAction(id, 'forceretry');
      },
      deleteTask: function(id) {
        vm.$refs.confirm.open('Delete task', 'Are you sure you want to delete this task?', 
        { color: 'warning' }).then((confirm) => {
          if (confirm) {
            this.doAction(id, 'delete');
          }
        })
      },
      doAction: function(id, action) {
        fetch(new URL(`task/${id}/${action}`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            throw Error(resp.statusText, resp.status);
          }
          return resp.json() 
        })
        .then(data => {
          this.$emit('newval', data.task);
        })
        .catch(error => {
          if (action == 'delete') {
            // create artificial object to show deletion
            this.$emit('newval', {'_id': id, 
              'state': "000",
              'key': "DELETED",
              'msg': "Task deleted"});
          } else {
            throw error;
          }
        })
      },
      colour: function(s) {
        if ([200].includes(s)) {
          return 'green';
        } else if ([102, 201].includes(s)) {
          return 'yellow';
        } else {
          return 'red';
        }
      }
   }
})

Vue.component('dane-newjob', {
  template: '#dane-newjob',
  data: () => ({
      dialog: false,
      source_id: '',
      source_url: '',
      tasks: '',
      state: ''
    }),
  methods: {
    newjob : function() {
      if (this.source_url.length > 0 && this.source_id.length > 0 
        && this.tasks.length > 0) {
        try {
        fetch(new URL('job', Config.API).href, {
          method: 'post',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 'source_url': this.source_url,
            'source_id': this.source_id, 
            'tasks': JSON.parse(this.tasks)})
        })
        .then((resp) => {
          if (!resp.ok) {
            throw Error(resp.statusText, resp.status);
          }
          return resp.json() 
        })
        .then(res => {
          this.dialog = false; 
          this.$emit('refresh')
        }).catch(error => {
          alert(error);
        })
        } catch(error) {
          this.state = 'Error: ' + error.message;
          console.error(error);
        }
      } else {
        this.state = 'All fields are required, please enter a source url, id, and a list of tasks';
      }
    }
  }
})

Vue.component('dane-workers', {
  template: '#dane-workers',
   data: function() {
      return {
        results: [],
        headers: [
          { 'text': 'Name', value: 'name' },
          { 'text': 'Active workers', value: 'active_workers' },
          { 'text': 'In queue', value: 'in_queue' }
        ]
      }
    },
  created: function() {
      this.load();
    },
  methods: {
      clickRow: function(value) {
        vm.switchWorker(value.name);
      },
      load: function() {
        fetch(new URL(`workers`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            this.errored = true;
            this.loading = false;
            throw Error(resp.statusText);
          }
          return resp.json() 
        })
        .then(data => {
          this.results = data;
          this.loading = false;
          })
        .catch(error => {
          // because network errors are type errors..
          if (error.name == 'TypeError') {
            this.loading = false;
            this.errored = true;
          }
          throw error;
        });
      },
   }
})

Vue.component('dane-worker-details', {
  template: '#dane-worker-details',
  props: ['taskkey'],
   data: function() {
      return {
        tasks: [],
        errored: false
      }
    },
  created: function() {
      this.load();
    },
  watch: {
    taskkey: function(n, o) { if (n != o) this.load(); }
  },
  methods: {
      load: function() {
        fetch(new URL(`workers/${this.taskkey}`, Config.API).href) 
        .then((resp) => {
          if (!resp.ok) {
            this.errored = true;
            throw Error(resp.statusText);
          }
          return resp.json() 
        })
        .then(data => {
          this.tasks = data;
          })
        .catch(error => {
          // because network errors are type errors..
          if (error.name == 'TypeError') {
            this.errored = true;
          }
          throw error;
        });
      },
    newVal: function(task) {
      this.tasks.find((o, i) => {
        if (o._id == task._id) {
          if (task.state == "000") {
              this.$delete(this.tasks, i);
          } else {
            Vue.set(this.tasks, i, {});
            setTimeout(() => { // add delay so we see change
              Vue.set(this.tasks, i, task);
            }, 10);
          }
          return true;
        }
      });
     }
   }
})

Vue.component('api-form', {
  template: '#api-form',
  data: () => ({
      new_api: Config.API,
      dialog: false
  }),
  methods: {
    open: function() {
      this.dialog = true;  
    },
    update: function() {
      Config.API = this.new_api;
      this.dialog = false;
    }
  }
})

// https://gist.github.com/eolant/ba0f8a5c9135d1a146e1db575276177d
Vue.component('confirm', {
  template: '#confirm',
  data: () => ({
    dialog: false,
    resolve: null,
    reject: null,
    message: null,
    title: null,
    options: {
      color: 'primary',
      width: 290,
      zIndex: 200
    }
  }),
  methods: {
    open(title, message, options) {
      this.dialog = true
      this.title = title
      this.message = message
      this.options = Object.assign(this.options, options)
      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    agree() {
      this.resolve(true)
      this.dialog = false
    },
    cancel() {
      this.resolve(false)
      this.dialog = false
    }
  }
});

var loc = window.location;
var baseUrl = loc.protocol + "//" + loc.hostname + (loc.port? ":"+loc.port : "") + "/"

var Config = {
  API: new URL('/DANE/', baseUrl).href
}

var vm = new Vue({
  el: '#app',
  vuetify: new Vuetify({
    theme: {
    themes: {
      light: {
          primary: "#ff5722",
          secondary: "#ffc107",
          accent: "#e91e63",
          error: "#f44336",
          warning: "#3f51b5",
          info: "#009688",
          success: "#8bc34a"
      },
    },
    }
  }),
  data: () => ({
    tab: "overview",
    worker: null,
    doc: null
  }),
  methods:  {
    switchDoc(id) {
      this.doc = id;
      this.tab = 'document';
    },
    switchWorker(key) {
      this.worker = key;
      this.tab = 'worker';
    },
  }
})
