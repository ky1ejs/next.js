use std::io::Write;

use anyhow::{bail, Result};
use indoc::writedoc;
use turbo_tasks::{TryJoinIterExt, Value, ValueToString, Vc};
use turbopack_binding::{
    turbo::tasks_fs::{rope::RopeBuilder, File, FileSystemPath},
    turbopack::{
        core::{
            asset::AssetContent, context::AssetContext, issue::IssueExt,
            reference_type::ReferenceType, virtual_source::VirtualSource,
        },
        ecmascript::{chunk::EcmascriptChunkPlaceable, utils::StringifyJs},
        turbopack::ModuleAssetContext,
    },
};

use super::app_entry::AppEntry;
use crate::{
    app_structure::LoaderTree,
    loader_tree::{LoaderTreeModule, ServerComponentTransition},
    mode::NextMode,
    next_app::UnsupportedDynamicMetadataIssue,
    next_server_component::NextServerComponentTransition,
};

/// Computes the entry for a Next.js app page.
#[turbo_tasks::function]
pub async fn get_app_page_entry(
    context: Vc<ModuleAssetContext>,
    loader_tree: Vc<LoaderTree>,
    app_dir: Vc<FileSystemPath>,
    pathname: String,
    project_root: Vc<FileSystemPath>,
) -> Result<Vc<AppEntry>> {
    let server_component_transition = Vc::upcast(NextServerComponentTransition::new());

    let loader_tree = LoaderTreeModule::build(
        loader_tree,
        context,
        ServerComponentTransition::Transition(server_component_transition),
        NextMode::Build,
    )
    .await?;

    let LoaderTreeModule {
        inner_assets,
        imports,
        loader_tree_code,
        unsupported_metadata,
        pages,
    } = loader_tree;

    if !unsupported_metadata.is_empty() {
        UnsupportedDynamicMetadataIssue {
            app_dir,
            files: unsupported_metadata,
        }
        .cell()
        .emit();
    }

    let mut result = RopeBuilder::default();

    for import in imports {
        writeln!(result, "{import}")?;
    }

    let pages = pages.iter().map(|page| page.to_string()).try_join().await?;

    // NOTE(alexkirsz) Keep in sync with
    // next.js/packages/next/src/build/webpack/loaders/next-app-loader.ts
    // TODO(alexkirsz) Support custom global error.
    let original_name = get_original_page_name(&pathname);

    writedoc!(
        result,
        r#"
            import RouteModule from "next/dist/server/future/route-modules/app-page/module"

            export const tree = {loader_tree_code}
            export const pages = {pages}
            export {{ default as GlobalError }} from "next/dist/client/components/error-boundary"
            export const originalPathname = {pathname}
            export const __next_app__ = {{
                require: __turbopack_require__,
                loadChunk: __turbopack_load__,
            }};

            export * from "next/dist/server/app-render/entry-base"

            // Create and export the route module that will be consumed.
            export const routeModule = new RouteModule({{
              definition: {{
                kind: "APP_PAGE",
                page: {page},
                pathname: {definition_pathname},
                // The following aren't used in production, but are
                // required for the RouteModule constructor.
                bundlePath: "",
                filename: "",
                appPaths: []
              }},
              userland: {{
                loaderTree: tree,
              }}
            }})
        "#,
        page = StringifyJs(&original_name),
        pages = StringifyJs(&pages),
        pathname = StringifyJs(&original_name),
        definition_pathname = StringifyJs(pathname),
    )?;

    let file = File::from(result.build());
    let source =
        // TODO(alexkirsz) Figure out how to name this virtual asset.
        VirtualSource::new(project_root.join("todo.tsx".to_string()), AssetContent::file(file.into()));

    let rsc_entry = context.process(
        Vc::upcast(source),
        Value::new(ReferenceType::Internal(Vc::cell(inner_assets))),
    );

    let Some(rsc_entry) =
        Vc::try_resolve_sidecast::<Box<dyn EcmascriptChunkPlaceable>>(rsc_entry).await?
    else {
        bail!("expected an ECMAScript chunk placeable asset");
    };

    Ok(AppEntry {
        pathname: pathname.to_string(),
        original_name,
        rsc_entry,
    }
    .cell())
}

// TODO(alexkirsz) This shouldn't be necessary. The loader tree should keep
// track of this instead.
fn get_original_page_name(pathname: &str) -> String {
    match pathname {
        "/" => "/page".to_string(),
        "/_not-found" => "/_not-found".to_string(),
        _ => format!("{}/page", pathname),
    }
}
