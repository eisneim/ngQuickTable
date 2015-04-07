ngQT.factory('$qtApi',[function(){
	var _id = 0;

	function Qtable(options){

		this.rawData = options.data || {def:[],records:[]};
		this.columnDef = options.columnDef;
		if( !this.columnDef ) this.columnDef = this.rawToColumnDef( this.rawData );

		this.container = options.container;
		this.id = options.id;

		// ----- some table style 
		if( !options.tableDef ) options.tableDef = {};
		this.theme = options.tableDef.theme || 'qt-theme-basic';//
		// is even rows have background color
		this.striped = options.tableDef.striped ;
		this.bordered = options.tableDef.bordered ;
		this.enableHover = options.tableDef.enableHover  ;

		// ----- pre defined data -------
		this.rows = [];
		this.records = options.records ||[];
		this.generateIdMap(this.records); // this.recordIdMap = {'989': {onerecord}, }

		// if autoMergeColumn is set to true, do some pre merge
		if( options.tableDef.autoMergeColumn ){
			this.autoMergeColumn = true;
			// ifMergeNeeded is defined in directive, so in the first time it won't run.
			if(typeof this.ifMergeNeeded == 'function'){
				this.ifMergeNeeded( this.columnDef );
			}else{
				if(!this.container)
					throw new Error('autoMergeColumn need container');
				var coldefs = this.isHeaderRowTooNarrow( this.columnDef , this.container );
				// console.log(coldefs);
				this.mergeColumn( coldefs ); 
			}
		}

		// if enable row selection, a column should be added infront
		// all we need to do is add a custom columnDef and add record to it;
		this.enableRowSelection = options.tableDef.rowSelection;
		if(this.enableRowSelection){
			this.rowSelection = {};
			this.addRowSelectionColumn();
		}

		/**
		 * if enable sort , we will just add trigger to the tableCell,
		 * the actual sort will happen in directive
		 */
		this.enableSort = options.tableDef.enableSort;
		if(this.enableSort){
			// console.log('sort is enabled')
		}

		// generate table template
		this.buildTable();
	}

	var pro = Qtable.prototype;

	pro.rawToColumnDef = function(raw){
		if( !Array.isArray(raw) ) throw new TypeError('raw data shoud be an array');
		var def = [];

		return def;
	}
	/**
	 * generate id map for all records, so it will be easier to access rows by their id
	 */
	pro.generateIdMap = function(records){
		this.recordIdMap = {};
		for (var i = records.length - 1; i >= 0; i--) {
			if(!records[i]._id ) records[i]._id = this.idGen('record');
			this.recordIdMap[ records[i]._id ] = records[i];
		};

		// we updated records id, so we can save it back
		this.records = records;
		return this.recordIdMap;
	}

	pro.buildTable = function(){
		// sort by col.order
		this.columnDef.sort(function(a,b){
			return a.order - b.order ;
		});

		this.tpl = this.buildTableTpl();
	}
	/**
	 * !!! should provide validation!!!!
	 */
	pro.reBuildTable = function(opt){
		// override some option
		for(var key in opt ){
			if(opt.hasOwnProperty(key)){
				this[key] = opt[key];
			}
		}

		this.buildTable();

		return this.tpl;
	}

	pro.buildTableTpl = function(){
		// some css styles
		var styleClasses = '';
		if( this.striped ) styleClasses+= 	' qt-striped';
		if( this.bordered ) styleClasses+= 	' qt-bordered';
		if( this.enableHover ) styleClasses+=' qt-hover';
		var tpl = '<table class="qt-table '+styleClasses+'" id="'+this.id+'" width="100%" >';
		

		var tHeadHTML = '<thead><tr class="qt-head-row">',  
			rowTpl = '<tr ng-repeat="record in records track by record._id" class="qt-row" ng-class="{active:rowSelection[record._id]}">' ,
			rowEditTpl = {};

		for(var colIndex=0; colIndex<this.columnDef.length; colIndex++ ){
			var colDef = this.columnDef[colIndex];
			var cellTpl= '';

			// build up table header
			var theader = colDef.headerTpl ? colDef.headerTpl : colDef.key;

			var theaderWidth = 'width="'+(colDef.width ? colDef.width : '')+'px"';
			var enableSort = this.enableSort ? this.getSortStringForTpl(colDef) : null;

			tHeadHTML += '<th '+theaderWidth + (enableSort?enableSort:'') +'>'+
				 theader +
				 (!enableSort?'':'<span class="qt-sort-arrow" ng-class="{up: qtvm.sortMap[\''+colDef.key+'\']==\'asc\', down: qtvm.sortMap[\''+colDef.key+'\']==\'desc\' }"><span>') +
			'</th>';

			/**
			 * determin which cell template should it be;
			 */
			if(colDef.type == 'combined'){
				if(!Array.isArray(colDef.fields) ) 
					throw new TypeError('kye:"'+colDef.key+'" type="combined" must have fields property, and it must be array');
				cellTpl = '<td '+this.getCellAttr(colDef.attr)+'class="qt-combined"><ul>';
				// cellEditTpl = '<td>'
				for(var ii=0;ii<colDef.fields.length; ii++ ){
					cellTpl += '<li>'+colDef.fields[ii].key+': {{record["'+colDef.fields[ii].key+'"]}}</li>';
				}
				cellTpl += '</ul></td>';

				rowEditTpl[colDef.key] = '还没有想好 怎么写';

			}else if( colDef.type == 'custom' ){
				if(!colDef.tpl) 
					throw new Error('if colDef.type == "custom" then this column def must have "tpl" property');
				cellTpl = '<td '+this.getCellAttr(colDef.attr)+'class="qt-custom">'+colDef.tpl + '</td>';
				// editing is not allowed for this column.
				rowEditTpl[colDef.key] = null;

			}else if(colDef.type == 'select' || colDef.type == 'boolean'){
				cellTpl = '<td '+this.getCellAttr(colDef.attr)+'class="qt-select">{{record["'+colDef.key+'"]}}</td>';

				if(!colDef.selectOption || !Array.isArray(colDef.selectOption.choices) )
					throw new Error('if colDef.type=="slect" or "boolean" then thisl column def must have "selectOption" and "colDef.selectOption.choices" must be array');

				// edit template
				rowEditTpl[colDef.key] = '<select>';
				colDef.selectOption.choices.forEach(function(choice,index){
					rowEditTpl[colDef.key] += '<option value="'+choice+'">'+choice+'</option>';
				});
				rowEditTpl[colDef.key] += '</select>';
			}else if(colDef.type == 'textarea'){
				cellTpl = '<td '+this.getCellAttr(colDef.attr)+'class="qt-textarea">{{record["'+colDef.key+'"]}}</td>';
				// edit template
				rowEditTpl[colDef.key] = '<textarea type="text"></textarea>';
			}else{ //colDef.type == 'input'
				cellTpl = '<td '+this.getCellAttr(colDef.attr)+'class="qt-input">{{record["'+colDef.key+'"]}}</td>';
				// edit template
				rowEditTpl[colDef.key] = '<input type="text" value="">';				
			}

			rowTpl += cellTpl;

		}
		tHeadHTML += '</tr></thead>';
		rowTpl += '</tr>';

		tpl+= tHeadHTML;
		tpl+= '<tbody>' + rowTpl +'</tbody>';

		tpl += '</table>';

		return tpl;
	}
	pro.getCellAttr = function( attrObj ){
		if(!attrObj) return '';
		var attrs = '';
		for(var aa in attrObj){
			if(!attrObj.hasOwnProperty( aa ) ) continue;
			attrs += ' '+ aa +'="'+attrObj[aa]+'"';
		}
		return attrs;
	}

	pro.addRowSelectionColumn = function(def){
		if(!def) def = {};
		var rowdef = {
			key:'rowSelect',
			order: 0,
			type: "custom",
			width: def.width || 50,
			headerTpl: def.headerTpl || '<div><input type="checkbox" ng-model="allRowSelected"/></div>',
			tpl: def.tpl || '<input type="checkbox" ng-model="rowSelection[record._id]"/>',
		};

		this.columnDef.unshift(rowdef);
	}

	pro.getSelectedRows = function(){
		// rest previous selection
		this.rows = [];
		for(var _id in this.rowSelection ){
			if(this.rowSelection[_id]){
				this.rows.push( this.recordIdMap[_id] );
			}
		}

		return this.rows;
	}
	pro.setSelectedRows = function( ids ){
		if(!Array.isArray(ids) ) 
			throw new TypeError('setSelectedRows(ids) only accept array of row id');

		ids.forEach(function(_id,index){
			// it must exisit
			if( this.recordIdMap[_id] ){ 
				this.rowSelection[ _id ] = true;
			}
		});
		return this.rowSelection;
	}
	// pro.clearSelectedRows = function(){

	// }

	// ------------- auto merge column -----------------
	/**
	 * simple check: sum of all header cell width should be greater than
	 * a minimal number based on
	 */
	pro.isHeaderRowTooNarrow = function( columnDefs , container ){
		var shouldBeMerged = [];
		var avgWidth = container.clientWidth / columnDefs.length; 

		/**
		 * sort by key length desc
		 */
		columnDefs.sort(function(a,b){
			return a.key.length - b.key.length;
		});
		
		if(avgWidth < 120 ){
			for (var ii = columnDefs.length - 1; ii >= 0; ii--) {
				if(shouldBeMerged.length >= 3 ) continue;
				var def = columnDefs[ii];
				if( 
					def.type != 'combined' && def.type != 'custom' && def.type != 'textarea' && !def.width 
				){
					shouldBeMerged.push( def );
				}
			};
		}
		return shouldBeMerged;
	}

	pro.mergeColumn = function( columnDefs ){
		if(!Array.isArray(columnDefs) ) 
			throw new TypeError('mergeColumn(columnDefs) only accept array of columnDef ');
		// if just one item , no need to merge;
		if(columnDefs.length <= 1) return;
		// sort the array ascending
		columnDefs.sort(function(a,b){
			return a.order - b.order;
		});
		// first, remove old def, then generata new def with the type of 'combined';
		var combinedDef = {
			key:'合并显示',
			order: columnDefs[0].order,
			type:'combined',
			isGerated: true,
			fields: [],
		}
		for (var ii = columnDefs.length - 1; ii >= 0; ii--) {
			var def = columnDefs[ii];
			combinedDef.fields.push( columnDefs[ii] );
			// remove old def
			this.columnDef = this.columnDef.filter(function(ee){
				if( ee.key != def.key ) return ee;
			});

		};

		// console.log('--this.columnDef')
		// console.log( this.columnDef );
		console.log('-----combinedDef')
		console.log(combinedDef)

		this.columnDef.splice(combinedDef.order,0, combinedDef );
		return this.columnDef
	}
	// ====================== sort row================
	/**
	 * 
	 * @param  {object} def the column def;
	 * @return {string} tpl like: ng-click="sortRow(....)"
	 */
	pro.getSortStringForTpl = function(def){
		if( ['custom','combined','textarea'].indexOf( def.type ) != -1 ) return null;
		return ' ng-click="qtvm.sortRow(\''+def.key+'\')" class="qt-sort-enabled"';
	}


	var idGen = pro.idGen = function(prefix){
		return prefix +'_'+ (_id++);
	}

	var api = {
		tables:{},
		create: function(options){
			var id = options.id || idGen('ngt');
			options.id = id;

			this.tables[id] = new Qtable( options );

			return this.tables[id]
		},
		getTable:function( id ){
			return this.tables[id];
		}
	}

	return api;
}]);