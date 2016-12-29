/** @jsx m */

import m from 'mithril'

export default  {

    selected: -1,
    onTabChangeFunc: null,

    oninit: function (vnode) {
        this.selected = typeof vnode.attrs.selected == 'number' ? parseInt(vnode.attrs.selected) : -1
        this.onTabChangeFunc = vnode.attrs.onTabChange
    },

    oncreate: function (vnode) {
        this.selectTab(0)
    },


    selectTab: function (index) {
        this.selected = index
        this.onTabChangeFunc && this.onTabChangeFunc(index)
    },

    view: function (vnode) {

        var self = this

        return (
            <div>

                <ul className="w3-navbar w3-light-gray w3-border">

                    {
                        vnode.children.map(function (tab, index) {


                            var bgColor = ""

                            if(self.selected == index) {
                                bgColor = "w3-gray"
                            }

                            return (
                                <li className={bgColor}>
                                    <a className="pointer" onclick={self.selectTab.bind(self, index)}>{tab.attrs.label}</a>
                                </li>
                            )
                        })
                    }
                </ul>

                {/* tab content */}
                {
                    self.selected > -1 ?
                        <div>
                            {vnode.children[self.selected]}
                        </div>
                        : ''
                }
            </div>
        );
    }

}