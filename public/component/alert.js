import m from 'mithril' 

function controller(attrs) {

	var self = this
	self.message = attrs.message
}

function view (ctrl) {

    return (
    	<div>
    		
    		<div class="w3-panel w3-padding-8 w3-pale-yellow w3-border w3-border-yellow">
				<p>{ctrl.message}</p>
			</div>

    	</div>
    );
}

export default { view, controller }

